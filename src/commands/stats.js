const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PlayerDiscordLink, Kill, Revive, Player, CommandCooldown } = require('../database/models');
const { Op } = require('sequelize');
const { sequelize } = require('../database/connection');
const logger = require('../utils/logger');

const COOLDOWN_MINUTES = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your Squad stats or another player\'s stats by Steam ID')
    .addStringOption(option =>
      option.setName('steamid')
        .setDescription('Steam ID to look up (optional, defaults to your linked account)')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const transaction = await sequelize.transaction();

    try {
      const discordId = interaction.user.id;
      const commandName = 'stats';
      const steamId = interaction.options.getString('steamid');

      // Check cooldown
      const cooldown = await CommandCooldown.findOne({
        where: {
          discord_id: discordId,
          command_name: commandName,
          last_used: {
            [Op.gte]: new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000)
          }
        },
        transaction
      });

      if (cooldown) {
        await transaction.rollback();
        const timeLeft = Math.ceil((cooldown.last_used.getTime() + COOLDOWN_MINUTES * 60 * 1000 - Date.now()) / 1000);
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        return interaction.editReply(`Please wait ${minutes} minutes and ${seconds} seconds before using this command again.`);
      }

      let playerId;
      if (steamId) {
        // Look up player by Steam ID
        const player = await Player.findOne({
          where: { steam_id: steamId },
          transaction
        });

        if (!player) {
          await transaction.rollback();
          return interaction.editReply('No player found with that Steam ID.');
        }
        playerId = player.id;
      } else {
        // Check if user is linked
        const link = await PlayerDiscordLink.findOne({ 
          where: { discord_id: discordId },
          transaction
        });

        if (!link) {
          await transaction.rollback();
          return interaction.editReply('You must link your Squad account first using /squadlink or provide a Steam ID.');
        }

        playerId = link.player_id;
      }

      // Fetch stats
      const kills = await Kill.count({ where: { attacker_id: playerId }, transaction });
      const deaths = await Kill.count({ where: { victim_id: playerId }, transaction });
      const teamkills = await Kill.count({ where: { attacker_id: playerId, teamkill: true }, transaction });
      const revivesGiven = await Revive.count({ where: { reviver_id: playerId }, transaction });
      const revivesReceived = await Revive.count({ where: { victim_id: playerId }, transaction });

      // Find nemesis
      const nemesisData = await Kill.findAll({
        attributes: ['attacker_id'],
        where: { victim_id: playerId },
        group: ['attacker_id'],
        order: [[sequelize.fn('COUNT', sequelize.col('attacker_id')), 'DESC']],
        limit: 1,
        include: [{ model: Player, as: 'attacker', attributes: ['last_known_name'] }],
        transaction
      });

      const nemesis = nemesisData.length > 0 ? nemesisData[0].attacker.last_known_name : 'None';
      const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

      // Get player info for display
      const player = await Player.findByPk(playerId, { transaction });

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`Stats for ${player.last_known_name}`)
        .setColor('#00ff00')
        .setDescription(`Steam ID: ${player.steam_id}`)
        .addFields(
          { name: 'Kills', value: kills.toString(), inline: true },
          { name: 'Deaths', value: deaths.toString(), inline: true },
          { name: 'K/D Ratio', value: kdRatio, inline: true },
          { name: 'Teamkills', value: teamkills.toString(), inline: true },
          { name: 'Revives Given', value: revivesGiven.toString(), inline: true },
          { name: 'Revives Received', value: revivesReceived.toString(), inline: true },
          { name: 'Nemesis', value: nemesis, inline: true }
        )
        .setFooter({ text: `Last seen: ${player.last_seen.toLocaleString()}` });

      // Update or create cooldown
      await CommandCooldown.upsert({
        discord_id: discordId,
        command_name: commandName,
        last_used: new Date()
      }, { transaction });

      // Commit the transaction
      await transaction.commit();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Stats displayed for player_id: ${playerId}`);

    } catch (error) {
      await transaction.rollback();
      logger.error(`Error fetching stats: ${error.message}`);
      await interaction.editReply('An error occurred while fetching your stats.');
    }
  }
}; 
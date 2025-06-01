const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PlayerDiscordLink, Kill, Revive, Player } = require('../database/models');
const { Op } = require('sequelize');
const { sequelize } = require('../database/connection');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display your Squad stats'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordId = interaction.user.id;

      // Check if user is linked
      const link = await PlayerDiscordLink.findOne({ where: { discord_id: discordId } });
      if (!link) {
        return interaction.editReply('You must link your Squad account first using /squadlink.');
      }

      const playerId = link.player_id;

      // Fetch stats
      const kills = await Kill.count({ where: { attacker_id: playerId } });
      const deaths = await Kill.count({ where: { victim_id: playerId } });
      const teamkills = await Kill.count({ where: { attacker_id: playerId, teamkill: true } });
      const revivesGiven = await Revive.count({ where: { reviver_id: playerId } });
      const revivesReceived = await Revive.count({ where: { victim_id: playerId } });

      // Find nemesis
      const nemesisData = await Kill.findAll({
        attributes: ['attacker_id'],
        where: { victim_id: playerId },
        group: ['attacker_id'],
        order: [[sequelize.fn('COUNT', sequelize.col('attacker_id')), 'DESC']],
        limit: 1,
        include: [{ model: Player, as: 'attacker', attributes: ['last_known_name'] }],
      });

      const nemesis = nemesisData.length > 0 ? nemesisData[0].attacker.last_known_name : 'None';
      const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('Squad Stats')
        .setColor('#00ff00')
        .addFields(
          { name: 'Kills', value: kills.toString(), inline: true },
          { name: 'Deaths', value: deaths.toString(), inline: true },
          { name: 'K/D Ratio', value: kdRatio, inline: true },
          { name: 'Teamkills', value: teamkills.toString(), inline: true },
          { name: 'Revives Given', value: revivesGiven.toString(), inline: true },
          { name: 'Revives Received', value: revivesReceived.toString(), inline: true },
          { name: 'Nemesis', value: nemesis, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Stats displayed for player_id: ${playerId}`);
    } catch (error) {
      logger.error(`Error fetching stats: ${error.message}`);
      await interaction.editReply('An error occurred while fetching your stats.');
    }
  },
}; 
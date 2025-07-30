const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');
const { sequelize } = require('../../database/connection');
const logger = require('../../utils/logger');
const roleConfig = require('../../config/roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killedby')
    .setDescription('Show who has killed a player in the last 2-6 hours')
    .addStringOption(option =>
      option.setName('steamid')
        .setDescription('Steam ID of the player to check')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('hours')
        .setDescription('Time range in hours (2 or 6)')
        .setRequired(false)
        .addChoices(
          { name: '2 hours', value: 2 },
          { name: '6 hours', value: 6 }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    // Check if user has permission to use this command
    if (!roleConfig.canUseCommand(interaction.member, 'killTracking')) {
      return interaction.reply({ 
        content: 'You do not have permission to use this command.',
        ephemeral: true 
      });
    }

    await interaction.deferReply();

    const transaction = await sequelize.transaction();

    try {
      const steamId = interaction.options.getString('steamid');
      const hours = interaction.options.getInteger('hours') || 2; // Default to 2 hours

      // Calculate time range
      const now = new Date();
      const timeRange = new Date(now.getTime() - (hours * 60 * 60 * 1000));

      const { Player } = sequelize.models;
      
      // Find the player
      const player = await Player.findOne({
        where: { steam_id: steamId },
        transaction
      });

      if (!player) {
        await transaction.rollback();
        return interaction.editReply(`No player found with Steam ID: ${steamId}`);
      }

      const { Kill, Weapon } = sequelize.models;
      
      // Get kills where this player was the victim
      const kills = await Kill.findAll({
        where: {
          victim_id: player.id,
          timestamp: {
            [Op.gte]: timeRange
          }
        },
        include: [
          {
            model: Player,
            as: 'attacker',
            attributes: ['last_known_name']
          },
          {
            model: Weapon,
            as: 'weapon',
            attributes: ['name']
          }
        ],
        order: [['timestamp', 'DESC']],
        transaction
      });

      if (kills.length === 0) {
        await transaction.rollback();
        return interaction.editReply(`No kills found for ${player.last_known_name} in the last ${hours} hours.`);
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`Who killed ${player.last_known_name}`)
        .setDescription(`Last ${hours} hours (${timeRange.toLocaleString()} - ${now.toLocaleString()})`)
        .setColor('#ff6b6b')
        .setFooter({ text: `Total deaths: ${kills.length}` });

      // Create a list of individual kills with timestamps
      const killList = kills.map(kill => {
        const attackerName = kill.attacker?.last_known_name || 'Unknown';
        const weaponName = kill.weapon?.name || 'Unknown';
        const killTime = kill.timestamp.toLocaleString();
        
        // Debug logging
        logger.debug('Kill data:', { 
          killId: kill.id, 
          weaponId: kill.weapon_id, 
          weaponName: weaponName,
          weaponObject: kill.weapon ? 'present' : 'null'
        });
        
        return `**${killTime}** - ${attackerName} (${weaponName})`;
      });

      // Split kills into chunks to avoid embed field limits
      const chunkSize = 10;
      for (let i = 0; i < killList.length; i += chunkSize) {
        const chunk = killList.slice(i, i + chunkSize);
        const fieldName = i === 0 ? 'Recent Deaths' : `Deaths (continued)`;
        
        embed.addFields({
          name: fieldName,
          value: chunk.join('\n'),
          inline: false
        });
      }

      if (kills.length === 0) {
        embed.addFields({
          name: 'No Deaths',
          value: 'No deaths recorded in this time period.',
          inline: false
        });
      }

      // Commit the transaction
      await transaction.commit();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`KilledBy command executed for player_id: ${player.id}, hours: ${hours}`);

    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in killedby command: ${error.message}`);
      await interaction.editReply('An error occurred while fetching the kill data.');
    }
  }
}; 
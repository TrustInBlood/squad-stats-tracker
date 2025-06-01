const { SlashCommandBuilder } = require('discord.js');
const { PlayerDiscordLink, UnlinkHistory } = require('../database/models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Unlink your Discord account from your Squad account'),

    async execute(interaction) {
        const transaction = await PlayerDiscordLink.sequelize.transaction();

        try {
            // Check if user has a linked account
            const link = await PlayerDiscordLink.findOne({
                where: { discord_id: interaction.user.id },
                transaction
            });

            if (!link) {
                await transaction.rollback();
                await interaction.reply({
                    content: 'You don\'t have any Squad accounts linked to your Discord account.',
                    ephemeral: true
                });
                return;
            }

            // Check for recent unlink (24-hour cooldown)
            const recentUnlink = await UnlinkHistory.findOne({
                where: {
                    discord_id: interaction.user.id,
                    unlinked_at: {
                        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
                    }
                },
                transaction
            });

            if (recentUnlink) {
                const timeLeft = Math.ceil((recentUnlink.unlinked_at.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 1000);
                await transaction.rollback();
                await interaction.reply({
                    content: `You can unlink your account again in ${Math.floor(timeLeft / 3600)} hours and ${Math.floor((timeLeft % 3600) / 60)} minutes.`,
                    ephemeral: true
                });
                return;
            }

            // Log the unlink in history first
            await UnlinkHistory.create({
                player_id: link.player_id,
                discord_id: link.discord_id,
                unlinked_at: new Date()
            }, { transaction });

            // Delete the link
            await link.destroy({ transaction });

            // Commit the transaction
            await transaction.commit();

            await interaction.reply({
                content: 'Your Squad account has been successfully unlinked from your Discord account.',
                ephemeral: true
            });

            logger.info('Account unlinked', {
                discordId: interaction.user.id,
                playerId: link.player_id
            });

        } catch (error) {
            // Rollback the transaction on any error
            await transaction.rollback();
            logger.error('Error executing unlink command:', error);

            if (!interaction.replied) {
                await interaction.reply({
                    content: 'There was an error unlinking your account. Please try again later.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: 'There was an error unlinking your account. Please try again later.',
                    ephemeral: true
                });
            }
        }
    }
}; 
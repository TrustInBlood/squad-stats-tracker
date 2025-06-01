const { SlashCommandBuilder } = require('discord.js');
const { VerificationCode } = require('../database/models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Generate a random 6-character code
function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('squadlink')
        .setDescription('Generate a verification code to link your Squad account'),

    async execute(interaction) {
        try {
            // Check for recent verification attempts (10-second cooldown)
            const recentAttempt = await VerificationCode.findOne({
                where: {
                    discord_id: interaction.user.id,
                    created_at: {
                        [Op.gte]: new Date(Date.now() - 10 * 1000) // 10 seconds ago
                    }
                }
            });

            if (recentAttempt) {
                const timeLeft = Math.ceil((recentAttempt.created_at.getTime() + 10 * 1000 - Date.now()) / 1000);
                await interaction.reply({
                    content: `Please wait ${timeLeft} seconds before requesting another code.`,
                    ephemeral: true
                });
                return;
            }

            // Generate new code
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

            // Send initial ephemeral message
            const reply = await interaction.reply({
                content: `Enter \`!link ${code}\` in Squad chat to link your account.\nThis code will expire in 10 minutes.`,
                ephemeral: true
            });

            // Store the verification code
            await VerificationCode.create({
                discord_id: interaction.user.id,
                code: code,
                created_at: new Date(),
                expires_at: expiresAt,
                interaction_token: interaction.token,
                application_id: interaction.applicationId
            });

            logger.info('Generated verification code', {
                discordId: interaction.user.id,
                code: code,
                expiresAt: expiresAt
            });

            // Set up expiration message update
            setTimeout(async () => {
                try {
                    const verification = await VerificationCode.findOne({
                        where: {
                            discord_id: interaction.user.id,
                            code: code,
                            message_id: reply.id
                        }
                    });

                    if (verification) {
                        // Code wasn't used, update the message
                        await interaction.editReply({
                            content: 'Your verification code has expired. Use `/squadlink` to generate a new one.',
                            ephemeral: true
                        });
                        await verification.destroy();
                    }
                } catch (error) {
                    logger.error('Error updating expired verification code message:', error);
                }
            }, 10 * 60 * 1000); // 10 minutes

        } catch (error) {
            logger.error('Error executing squadlink command:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'There was an error generating your verification code. Please try again.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: 'There was an error generating your verification code. Please try again.',
                    ephemeral: true
                });
            }
        }
    }
}; 
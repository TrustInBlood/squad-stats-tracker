const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
            // Check for recent verification attempts (10-minute cooldown)
            const recentAttempt = await VerificationCode.findOne({
                where: {
                    discord_id: interaction.user.id,
                    created_at: {
                        [Op.gte]: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
                    }
                }
            });

            if (recentAttempt) {
                const timeLeft = Math.ceil((recentAttempt.created_at.getTime() + 10 * 60 * 1000 - Date.now()) / 1000);
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                await interaction.reply({
                    content: `Please wait ${minutes} minutes and ${seconds} seconds before requesting another code.`,
                    ephemeral: true
                });
                return;
            }

            // Generate new code
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

            // Send initial ephemeral message
            const unixExpires = Math.floor(expiresAt.getTime() / 1000);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Squad Account Linking')
                .setDescription('Follow these steps to link your Squad account:')
                .addFields(
                    { name: 'Step 1', value: 'Join one of our Squad servers', inline: false },
                    { name: 'Step 2', value: 'Copy and paste this command in the in-game chat:', inline: false },
                    { name: 'Command', value: `\`\`\`!link ${code}\`\`\``, inline: false },
                    { name: 'Step 3', value: 'Wait for confirmation message', inline: false },
                    { name: 'Code Expires', value: `<t:${unixExpires}:F> (your local time)`, inline: false }
                )
                .setFooter({ text: `Code expires in 10 minutes` });

            const reply = await interaction.reply({
                embeds: [embed],
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
                            code: code
                        }
                    });

                    if (verification) {
                        // Code wasn't used, update the message
                        const expiredEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Verification Code Expired')
                            .setDescription('Your verification code has expired.')
                            .addFields(
                                { name: 'What to do next', value: 'Use `/squadlink` to generate a new code.', inline: false }
                            );
                        await interaction.editReply({
                            embeds: [expiredEmbed],
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
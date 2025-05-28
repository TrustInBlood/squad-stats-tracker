const { DiscordSteamLink } = require('../database/models');
const { verification: logger } = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

class ChatVerificationHandler {
    constructor(client) {
        this.client = client;
        this.handleChatMessage = this.handleChatMessage.bind(this);
        // Store pending verifications with their interaction messages
        this.pendingVerifications = new Map();
        logger.info('ChatVerificationHandler initialized');
    }

    // Add method to store interaction message for a verification code
    storeVerificationMessage(code, interaction) {
        logger.debug('Storing verification message', { code, interactionId: interaction.id });
        this.pendingVerifications.set(code, interaction);
        // Clean up after expiration
        setTimeout(() => {
            logger.debug('Cleaning up expired verification message', { code });
            this.pendingVerifications.delete(code);
        }, 15 * 60 * 1000); // 15 minutes
    }

    async handleChatMessage(eventData) {
        logger.debug('Received chat message for verification', {
            event: eventData.event,
            serverID: eventData.serverID,
            data: eventData.data
        });

        if (!eventData || eventData.event !== 'CHAT_MESSAGE') {
            logger.debug('Ignoring non-chat event', { event: eventData?.event });
            return;
        }

        // Extract message and steamID from CHAT_MESSAGE event
        const message = eventData.data.message;
        const steamID = eventData.data.steamID;
        const serverID = eventData.serverID;
        
        if (!message || !steamID || !serverID) {
            logger.debug('Missing required chat data', { message, steamID, serverID });
            return;
        }

        // Check if this is a verification code
        const code = message.trim().toUpperCase();
        logger.debug('Checking verification code', { code, steamID, serverID });

        if (!/^[A-Z0-9]{6}$/.test(code)) {
            logger.debug('Message is not a valid verification code', { code });
            return; // Not a verification code
        }

        try {
            logger.info(`Attempting to verify code ${code} for Steam ID ${steamID} on server ${serverID}`);
            
            // Check if this Steam ID is already linked
            const existingLink = await DiscordSteamLink.findOne({
                where: {
                    steamID,
                    isVerified: true
                }
            });

            if (existingLink) {
                logger.info(`Steam ID ${steamID} is already linked to Discord user ${existingLink.discordID}`);
                // Update the original message if we have it
                const interaction = this.pendingVerifications.get(code);
                logger.debug('Found interaction for existing link', { 
                    code, 
                    hasInteraction: !!interaction,
                    interactionId: interaction?.id 
                });
                if (interaction) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Verification Failed')
                        .setDescription('This Steam account is already linked to another Discord account.')
                        .addFields(
                            { name: 'Steam ID', value: steamID },
                            { name: 'Linked To', value: `<@${existingLink.discordID}>` }
                        );
                    await interaction.editReply({ embeds: [embed] });
                    this.pendingVerifications.delete(code);
                }
                return;
            }

            // Try to verify the code with the Steam ID from the chat message
            const { success, link, error } = await DiscordSteamLink.verifyLink(code, serverID, steamID);
            
            if (!success) {
                logger.info(`Verification failed for Steam ID ${steamID}`, { error });
                // Check if the code exists but is expired
                const expiredLink = await DiscordSteamLink.findOne({
                    where: {
                        verificationCode: code,
                        isVerified: false
                    }
                });
                if (expiredLink) {
                    logger.info(`Found expired verification code for Discord user ${expiredLink.discordID}`);
                    // Update the original message if we have it
                    const interaction = this.pendingVerifications.get(code);
                    logger.debug('Found interaction for expired code', { 
                        code, 
                        hasInteraction: !!interaction,
                        interactionId: interaction?.id 
                    });
                    if (interaction) {
                        const embed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Verification Failed')
                            .setDescription('The verification code has expired. Please use `/link` to generate a new code.');
                        await interaction.editReply({ embeds: [embed] });
                        this.pendingVerifications.delete(code);
                    }
                }
                return;
            }

            // Update the original message if we have it
            const interaction = this.pendingVerifications.get(code);
            logger.debug('Found interaction for successful verification', { 
                code, 
                hasInteraction: !!interaction,
                interactionId: interaction?.id 
            });
            if (interaction) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('Account Link Verified!')
                    .setDescription('Your Discord account has been successfully linked with your Squad account.')
                    .addFields(
                        { name: 'Steam ID', value: link.steamID },
                        { name: 'Verified On', value: new Date().toLocaleString() },
                        { name: 'Server', value: serverID }
                    );
                try {
                    await interaction.editReply({ embeds: [embed] });
                    logger.debug('Successfully updated verification message');
                } catch (error) {
                    logger.error('Failed to update verification message', { error });
                    // If we can't edit the original message, try to send a new one
                    try {
                        const channel = await this.client.channels.fetch(interaction.channelId);
                        if (channel) {
                            await channel.send({ 
                                content: `<@${link.discordID}> Your account has been successfully linked!`,
                                embeds: [embed]
                            });
                        }
                    } catch (sendError) {
                        logger.error('Failed to send new verification message', { error: sendError });
                    }
                }
                this.pendingVerifications.delete(code);
            } else {
                logger.warn('No interaction found for successful verification', { code });
                // Try to send a new message to the user
                try {
                    const user = await this.client.users.fetch(link.discordID);
                    if (user) {
                        const embed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('Account Link Verified!')
                            .setDescription('Your Discord account has been successfully linked with your Squad account.')
                            .addFields(
                                { name: 'Steam ID', value: link.steamID },
                                { name: 'Verified On', value: new Date().toLocaleString() },
                                { name: 'Server', value: serverID }
                            );
                        await user.send({ embeds: [embed] });
                        logger.info('Sent DM to user about successful verification', { discordID: link.discordID });
                    }
                } catch (dmError) {
                    logger.error('Failed to send DM about successful verification', { error: dmError, discordID: link.discordID });
                }
            }

            logger.info(`Successfully verified link for Discord user ${link.discordID} with Steam ID ${steamID}`);
        } catch (error) {
            logger.error('Error processing chat verification', { error });
            // Update the original message if we have it
            const interaction = this.pendingVerifications.get(code);
            logger.debug('Found interaction for error case', { 
                code, 
                hasInteraction: !!interaction,
                interactionId: interaction?.id 
            });
            if (interaction) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Verification Failed')
                    .setDescription('There was an error processing your verification. Please try again later.');
                try {
                    await interaction.editReply({ embeds: [embed] });
                    logger.debug('Successfully updated error message');
                } catch (error) {
                    logger.error('Failed to update error message', { error });
                }
                this.pendingVerifications.delete(code);
            }
        }
    }
}

module.exports = ChatVerificationHandler; 
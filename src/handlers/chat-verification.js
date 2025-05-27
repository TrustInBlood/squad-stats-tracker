const { DiscordSteamLink } = require('../database/models');
const logger = require('../utils/logger');

class ChatVerificationHandler {
    constructor(client) {
        this.client = client;
        this.handleChatMessage = this.handleChatMessage.bind(this);
    }

    async handleChatMessage(eventData) {
        if (!eventData || eventData.event !== 'PLAYER_CHAT') {
            return;
        }

        const { message, steamID, serverID } = eventData.data;
        
        // Check if this is a verification code
        const code = message.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            return; // Not a verification code
        }

        try {
            // Try to verify the code with the Steam ID from the chat message
            const { success, link, error } = await DiscordSteamLink.verifyLink(code, serverID, steamID);
            
            if (!success) {
                logger.debug(`Invalid verification attempt from Steam ID ${steamID}: ${error}`);
                return;
            }

            // Get the Discord user
            const user = await this.client.users.fetch(link.discordID);
            if (!user) {
                logger.error(`Could not find Discord user ${link.discordID} for verification`);
                return;
            }

            // Send verification success DM
            try {
                await user.send({
                    embeds: [{
                        color: 0x00ff00,
                        title: 'Account Link Verified!',
                        description: 'Your Discord account has been successfully linked with your Squad account.',
                        fields: [
                            { name: 'Steam ID', value: link.steamID },
                            { name: 'Verified On', value: new Date().toLocaleString() },
                            { name: 'Server', value: serverID }
                        ]
                    }]
                });
            } catch (dmError) {
                logger.error(`Could not send verification DM to user ${link.discordID}:`, dmError);
                // Continue anyway since the link is still valid
            }

            logger.info(`Successfully verified link for Discord user ${link.discordID} with Steam ID ${steamID}`);
        } catch (error) {
            logger.error('Error processing chat verification:', error);
        }
    }
}

module.exports = ChatVerificationHandler; 
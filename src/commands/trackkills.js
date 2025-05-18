const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const ServerManager = require('../utils/serverManager');

// Create a single server manager instance
const serverManager = new ServerManager();

// Store active tracking channels
const activeTrackingChannels = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trackkills')
        .setDescription('Start or stop tracking kills from Squad servers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start tracking kills in the current channel')
                .addIntegerOption(option =>
                    option
                        .setName('server_id')
                        .setDescription('The ID of the server to track (leave empty for all servers)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop tracking kills in the current channel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const channelId = interaction.channelId;

            if (subcommand === 'start') {
                // Check if already tracking in this channel
                if (activeTrackingChannels.has(channelId)) {
                    await interaction.reply({
                        content: 'Kill tracking is already active in this channel!',
                        ephemeral: true
                    });
                    return;
                }

                const serverId = interaction.options.getInteger('server_id');

                // Connect to servers if not already connected
                if (serverId) {
                    const serverConfig = serverManager.config.servers.find(s => s.id === serverId);
                    if (!serverConfig) {
                        await interaction.reply({
                            content: `Server ID ${serverId} not found in configuration!`,
                            ephemeral: true
                        });
                        return;
                    }
                    await serverManager.connectToServer(serverConfig);
                } else {
                    await serverManager.connectToAllServers();
                }

                // Set up kill event handler for this channel
                const killHandler = (killData) => {
                    // Only send kills from the specified server if serverId is provided
                    if (serverId && killData.serverId !== serverId) return;

                    const channel = interaction.client.channels.cache.get(channelId);
                    if (channel) {
                        // Format attacker IDs
                        const attackerIDs = Object.entries(killData.attackerIDs)
                            .map(([platform, id]) => `${platform}: ${id}`)
                            .join('\n');

                        channel.send({
                            embeds: [{
                                title: '💀 Kill Event',
                                description: `${killData.killer} killed ${killData.victim}`,
                                fields: [
                                    { name: 'Weapon', value: killData.weapon, inline: true },
                                    { name: 'Damage', value: killData.damage.toFixed(1), inline: true },
                                    { name: 'Server', value: `Server ${killData.serverId}`, inline: true },
                                    { name: 'Time', value: killData.timestamp.toLocaleTimeString(), inline: true },
                                    { name: 'Chain ID', value: killData.chainID, inline: true },
                                    { name: 'Attacker IDs', value: attackerIDs || 'Unknown', inline: false }
                                ],
                                color: 0xFF0000,
                                timestamp: killData.timestamp.toISOString()
                            }]
                        }).catch(error => {
                            logger.error('Error sending kill message to channel:', error);
                        });
                    }
                };

                // Add the handler to the server manager
                serverManager.on('kill', killHandler);
                activeTrackingChannels.set(channelId, {
                    serverId,
                    killHandler
                });

                await interaction.reply({
                    content: serverId 
                        ? `Started tracking kills from server ${serverId} in this channel!`
                        : 'Started tracking kills from all servers in this channel!',
                    ephemeral: true
                });

            } else if (subcommand === 'stop') {
                const tracking = activeTrackingChannels.get(channelId);
                if (!tracking) {
                    await interaction.reply({
                        content: 'No kill tracking is active in this channel!',
                        ephemeral: true
                    });
                    return;
                }

                // Remove the kill handler
                serverManager.removeListener('kill', tracking.killHandler);
                activeTrackingChannels.delete(channelId);

                // If this was the last channel tracking a specific server, disconnect from it
                if (tracking.serverId) {
                    const hasOtherChannels = Array.from(activeTrackingChannels.values())
                        .some(t => t.serverId === tracking.serverId);
                    
                    if (!hasOtherChannels) {
                        serverManager.disconnectFromServer(tracking.serverId);
                    }
                } else {
                    // If no channels are tracking any servers, disconnect from all
                    if (activeTrackingChannels.size === 0) {
                        serverManager.disconnectFromAllServers();
                    }
                }

                await interaction.reply({
                    content: 'Stopped tracking kills in this channel!',
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Error in trackkills command:', error);
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true
            });
        }
    },
}; 
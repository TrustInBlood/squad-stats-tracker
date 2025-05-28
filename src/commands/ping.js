const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction) {
        try {
            console.log(`Received interaction: ${interaction.commandName}`);
            // Defer the reply immediately to prevent timeout
            await interaction.deferReply();
            
            // Calculate latencies
            const apiLatency = Math.round(interaction.client.ws.ping);
            const latency = Date.now() - interaction.createdTimestamp;
            
            // Edit the deferred reply with the results
            await interaction.editReply(`Pong! 🏓\nBot Latency: ${latency}ms\nAPI Latency: ${apiLatency}ms`);
            logger.debug(`Ping command executed by ${interaction.user.tag}`);
        } catch (error) {
            logger.error('Error executing ping command:', error);
            // If we haven't replied yet, send a new reply
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'There was an error executing this command!', 
                    ephemeral: true 
                });
            } else {
                // If we have replied, try to edit the reply
                await interaction.editReply('There was an error executing this command!');
            }
        }
    },
}; 
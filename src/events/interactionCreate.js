const logger = require('../utils/logger');
const { InteractionResponseFlags } = require('discord.js');
const { sequelize } = require('../database/connection');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle autocomplete interactions
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                logger.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                logger.error(`Error executing autocomplete for ${interaction.commandName}:`, error);
            }
            return;
        }

        // Handle chat input commands
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            logger.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction, sequelize);
            logger.debug(`Command ${interaction.commandName} executed by ${interaction.user.tag}`);
        } catch (error) {
            logger.error(`Error executing ${interaction.commandName}:`, error);

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: 'There was an error while executing this command!' });
            } else {
                await interaction.reply({ 
                    content: 'There was an error while executing this command!', 
                    ephemeral: true 
                });
            }
        }
    }
}; 
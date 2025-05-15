const logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            logger.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
            logger.debug(`Command ${interaction.commandName} executed by ${interaction.user.tag}`);
        } catch (error) {
            logger.error(`Error executing ${interaction.commandName}:`, error);

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: 'There was an error while executing this command!' });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }
}; 
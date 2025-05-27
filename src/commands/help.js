const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Lists all available commands')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Get detailed help for a specific command')
                .setRequired(false)
                .setAutocomplete(true)),
    async execute(interaction) {
        try {
            const specificCommand = interaction.options.getString('command');
            const commands = interaction.client.commands;

            // If a specific command was requested
            if (specificCommand) {
                const command = commands.get(specificCommand);
                if (!command) {
                    await interaction.reply({
                        content: `Command \`${specificCommand}\` not found.`,
                        ephemeral: true
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Command: /${command.data.name}`)
                    .setDescription(command.data.description)
                    .addFields(
                        { name: 'Usage', value: `\`/${command.data.name}\`` }
                    );

                // Add options if the command has any
                if (command.data.options?.length > 0) {
                    const optionsList = command.data.options.map(opt => {
                        let optionText = `\`${opt.name}\`: ${opt.description}`;
                        if (opt.required) optionText += ' (Required)';
                        return optionText;
                    }).join('\n');
                    embed.addFields({ name: 'Options', value: optionsList });
                }

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            // Create categories for different types of commands
            const categories = {
                'Player Stats': [],
                'Server Stats': [],
                'Account Management': [],
                'Utility': []
            };

            // Sort commands into categories
            commands.forEach(command => {
                const name = command.data.name.toLowerCase();
                if (name.includes('player') || name.includes('stats')) {
                    categories['Player Stats'].push(command);
                } else if (name.includes('server')) {
                    categories['Server Stats'].push(command);
                } else if (name.includes('link') || name.includes('verify')) {
                    categories['Account Management'].push(command);
                } else {
                    categories['Utility'].push(command);
                }
            });

            // Create the main help embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Squad Stats Bot Help')
                .setDescription('Here are all available commands. Use `/help <command>` for detailed information about a specific command.')
                .setFooter({ text: 'Tip: Commands are slash commands. Type / to see the list.' });

            // Add fields for each category that has commands
            Object.entries(categories).forEach(([category, cmds]) => {
                if (cmds.length > 0) {
                    const commandList = cmds
                        .map(cmd => `\`/${cmd.data.name}\`: ${cmd.data.description}`)
                        .join('\n');
                    embed.addFields({ name: category, value: commandList });
                }
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            logger.debug(`Help command executed by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Error executing help command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error executing this command!',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: 'There was an error executing this command!',
                    ephemeral: true
                });
            }
        }
    },
    // Add autocomplete for the command option
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = Array.from(interaction.client.commands.keys());
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    }
}; 
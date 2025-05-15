require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.DISCORD_GUILD_ID) {
            throw new Error('DISCORD_GUILD_ID is required in .env file');
        }

        logger.info(`Started refreshing ${commands.length} application (/) commands for guild ${process.env.DISCORD_GUILD_ID}.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
            { body: commands },
        );

        logger.info(`Successfully reloaded ${data.length} application (/) commands for guild ${process.env.DISCORD_GUILD_ID}.`);
    } catch (error) {
        logger.error('Error registering commands:', error);
    }
})(); 
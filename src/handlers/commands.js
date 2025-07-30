const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

module.exports = (client) => {
    const commandsPath = path.join(__dirname, '..', 'commands');
    
    // Function to load commands from a directory recursively
    const loadCommands = (dirPath) => {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                // Recursively load commands from subdirectories
                loadCommands(fullPath);
            } else if (item.isFile() && item.name.endsWith('.js')) {
                const command = require(fullPath);

                // Set a new item in the Collection with the key as the command name and the value as the exported module
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    logger.debug(`Loaded command: ${command.data.name} from ${fullPath}`);
                } else {
                    logger.warn(`The command at ${fullPath} is missing a required "data" or "execute" property.`);
                }
            }
        }
    };
    
    // Load all commands from the commands directory and subdirectories
    loadCommands(commandsPath);
}; 
# Squad Stats Tracker

A Discord bot for tracking and analyzing Squad game statistics in real-time.

## Description

This project provides a comprehensive statistics tracking system for Squad gameplay, using WebSocket connections to collect real-time data from Squad servers. The bot processes and stores this data, allowing players and server administrators to monitor performance and progress through Discord commands.

## Features

- Real-time data collection via WebSocket connections
- Multiple server support with automatic reconnection
- Discord slash commands for data access
- Database storage for historical analysis
- Comprehensive logging and error handling

## Getting Started

1. Clone the repository
2. Copy `src/config/servers.example.js` to `src/config/servers.js` and configure your servers
3. Create a `.env` file with required environment variables
4. Install dependencies: `npm install`
5. Start the bot: `npm start`

More detailed setup and configuration instructions will be added as the project develops.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Database: Drop and Recreate with Correct Encoding

If you need to reset your MariaDB database and ensure it uses full Unicode support, you can use the following command:

```sh
mysql -u root -p -e "DROP DATABASE squad_stats; CREATE DATABASE squad_stats CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

After recreating the database, run your migrations to set up the tables:

```sh
npm run migrate
``` 
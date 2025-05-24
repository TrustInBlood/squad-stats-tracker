# SquadStats Discord Bot - Project Planning

## Project Overview
SquadStats is a Discord bot that collects and stores Squad game server statistics in a database, providing users with access to this data through Discord commands. The bot will track player stats, server events, and other relevant game data to offer insights and analytics to server administrators and players.

## Goals
- Create a Discord bot that connects to Squad game servers
- Collect and store relevant game data in a database
- Provide Discord commands for users to query and display statistics
- Offer visualization of stats through charts and graphs (optional)
- Easy setup and configuration for server administrators

## Architecture

### Components
1. **Discord Bot**: Built using Discord.js to handle user interactions and commands
   - Modular command and event handler system
   - Slash command implementation
   - Winston-based logging system
2. **Squad Server Connection**: Module to connect to and retrieve data from Squad game servers
3. **Database**: Store collected data for persistent access and analysis
   - MariaDB with Sequelize ORM
   - Connection pooling and error handling
4. **Analytics Engine**: Process raw data into meaningful statistics and insights
5. **Command Handler**: Process user commands and return appropriate data
   - Modular command structure
   - Error handling and logging
   - Permission system (planned)

### Technology Stack
- **Language**: JavaScript/Node.js
- **Discord Integration**: Discord.js v14
- **Database**: MariaDB with Sequelize ORM
- **Logging**: Winston
- **Configuration**: dotenv for environment variables
- **Squad Integration**: Custom module based on SquadJS concepts (planned)
- **Hosting**: Capable of running on standard VPS or cloud service

## Features

### Core Features
- Player statistics tracking (kills, deaths, assists, etc.)
- Server event logging (rounds, map rotations, etc.)
- Team and squad performance metrics
- Command-based data retrieval
- Administrative commands for bot management

### Extended Features
- Automated reporting (daily/weekly summaries)
- Player ranking and leaderboards
- Role-based access to different commands
- Customizable stat tracking preferences
- Match history and detailed match analysis
- Visual representations of statistics (charts, graphs)

## Data Schema (Preliminary)

### Players Collection
- Player ID (Steam ID)
- Username (most recent)
- Historical usernames
- Stats (kills, deaths, assists, etc.)
- Session history
- Roles played
- Teams joined

### Matches Collection
- Match ID
- Date/Time
- Map
- Duration
- Teams data
- Events timeline
- Final score

### Servers Collection
- Server ID
- Server name
- Configuration
- Current status
- Historical data references

## Integration Points

### Discord Integration
- Slash command implementation
- Modular command and event handler system
- Role-based permissions (planned)
- Embed message formatting
- Reaction-based navigation
- Winston-based logging system

### Squad Server Integration
- WebSocket connection using socket.io-client
- Real-time event handling
- Direct server queries via WebSocket
- Event handling and data processing
- Automatic reconnection and error handling

## Deployment Strategy
- Deployed to an egg. 
- Configuration via environment variables and/or config files
- Database migration/setup scripts
- Backup and recovery procedures

## Maintenance Plan
- Regular database backups
- Performance monitoring
- Error logging and reporting
- Update schedule for dependencies

## Potential Challenges
- Rate limiting (both Discord API and Squad servers)
- Data consistency across server restarts
- Handling edge cases in game events
- Scaling with multiple servers
- Optimizing database queries for performance

## Success Metrics
- Bot uptime percentage
- Command response time
- User engagement metrics
- Data accuracy when compared to in-game stats
- Administrator satisfaction surveys

## Configuration Management

### Server Configuration
- Server details stored in `config/servers.json` (gitignored)
- Supports multiple Squad servers
- Configuration includes:
  - Server connection details (host, ports)
  - RCON authentication
  - Log file locations

### Security Considerations
- **TODO**: Review and improve credential management
  - Current: RCON passwords stored in plaintext in config file
  - Future: Consider moving sensitive data to environment variables or db
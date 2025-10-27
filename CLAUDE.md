# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Squad Stats Tracker is a Discord bot that collects real-time game statistics from Squad game servers via WebSocket connections and stores them in a MariaDB database. The bot provides Discord slash commands for querying player stats, leaderboards, and account linking.

## Common Commands

### Development
```bash
npm start              # Start the bot
npm run dev            # Start with nodemon for auto-restart
npm test               # Run tests with Jest
```

### Database Management
```bash
npm run migrate        # Run all pending migrations
npm run migrate:undo   # Undo last migration
npm run db:migrate     # Alternative migration command using init.js
```

### Discord Commands
```bash
node src/deploy-commands.js  # Deploy slash commands to Discord
```

### Database Reset (with UTF-8 support)
```bash
mysql -u root -p -e "DROP DATABASE squad_stats; CREATE DATABASE squad_stats CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run migrate
```

## Architecture

### Application Lifecycle

The bot follows a specific initialization sequence (`src/index.js`):
1. Database initialization and migration via Umzug (`src/database/init.js`)
2. WebSocket connections to Squad servers via ServerManager (`src/utils/server-manager.js`)
3. Weapon cache initialization (`src/utils/weapon-utils.js`)
4. Scheduler and leaderboard cron jobs start (`src/utils/scheduler.js`, `src/utils/leaderboard.js`)
5. Command and event handlers load (`src/handlers/commands.js`, `src/handlers/events.js`)
6. Discord client login

The bot runs in "degraded mode" if database connection fails, allowing WebSocket connections to continue.

### Core Components

**ServerManager** (`src/utils/server-manager.js`)
- Manages WebSocket connections to multiple Squad servers using socket.io-client
- Handles automatic reconnection with exponential backoff (up to 10 attempts, 30s delay)
- Emits events to EventBuffer for processing
- Configuration loaded from `src/config/servers.js` (gitignored, use `servers.example.js` as template)

**EventBuffer** (`src/utils/event-buffer.js`)
- Buffers incoming game events (PLAYER_WOUNDED, PLAYER_DIED, PLAYER_REVIVED, etc.)
- Flushes events in transactions every 5 seconds or when buffer reaches 100 events
- PLAYER_DIED events have a special 10-second delay before processing to allow matching with PLAYER_WOUNDED events
- Implements retry logic (max 3 attempts with exponential backoff) and dead-letter queue for failed events
- Writes failed events to `logs/dead-letter/` as JSON files

**Command System** (`src/handlers/commands.js`)
- Recursively loads commands from `src/commands/` and subdirectories
- Commands require `data` (SlashCommandBuilder) and `execute` function
- Supports hierarchical role-based permissions via `src/config/roles.js`

**Database Models** (`src/database/models/`)
- Sequelize ORM with auto-loading via `index.js`
- Key models: Player, Kill, PlayerWounded, Revive, Weapon
- Associations defined in model files via `associate()` method
- Migrations managed by Umzug, stored in `src/database/migrations/`

### Event Processing Flow

1. Squad server emits event via WebSocket → ServerManager receives it
2. ServerManager adds event to EventBuffer
3. EventBuffer accumulates events until flush trigger (time/size/age)
4. On flush, events are processed in transactions:
   - `upsertPlayer()` creates/updates player records by Steam ID
   - Event-specific handlers create records (kills, wounds, revives)
   - For PLAYER_DIED: queries PlayerWounded table to find matching weapon_id
   - For CHAT_MESSAGE: upserts player records from chat messages
5. Failed events retry with exponential backoff or move to dead-letter queue

### Role-Based Permissions

Configured in `src/config/roles.js` (gitignored, use `roles.example.js` as template):
- Hierarchical system: staff (1) < admin (2) < senior_admin (3) < head_admin (4)
- Higher roles automatically inherit lower role permissions
- Helper functions: `getUserRoleLevel()`, `hasPermission()`, `canUseCommand()`

### Leaderboard System

- Two automatic leaderboards: 24-hour (updates hourly) and 7-day (updates every 6 hours)
- Managed by node-cron in `src/utils/leaderboard.js`
- Stores message IDs in LeaderboardConfig table to edit existing messages
- Channel ID configured via `LEADERBOARD_CHANNEL_ID` environment variable

## Key Development Patterns

### Creating Migrations

Always use sequelize-cli to generate migration files with correct timestamps:
```bash
npm run migrate:create -- --name create-table-name
```
Then populate the generated file with migration logic.

### Adding New Event Types

1. Add event type to `EventBuffer.buffers` object
2. Create handler method `handleEventName()` in EventBuffer
3. Add case in `flushBuffer()` switch statement
4. Update `lastFlush` tracking object

### Creating Commands

Commands in subdirectories are automatically loaded. Structure:
```javascript
module.exports = {
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Description'),
  async execute(interaction) {
    // Command logic
  }
};
```

### Upsert Pattern for Players

Use `upsertPlayer()` from `src/utils/player-utils.js`:
- Accepts event object with `data.attacker` and/or `data.victim`
- Returns array of player IDs in order: [attackerId, victimId]
- Creates player if not exists, updates last_seen timestamp
- Works within transactions

### Transaction Usage

All database operations in EventBuffer use transactions with 5-second timeout:
```javascript
const transaction = await sequelize.transaction({ timeout: 5000 });
try {
  // operations
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

## Configuration Files

**Required Setup** (copy from examples, these are gitignored):
- `src/config/servers.js` - Squad server WebSocket URLs and auth tokens
- `src/config/roles.js` - Discord role IDs for permission system
- `.env` - Environment variables (see `.env.example`)

**Important Environment Variables**:
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` - Bot authentication
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - MariaDB connection
- `LEADERBOARD_CHANNEL_ID` - Channel for automatic leaderboard posts
- `STATS_CHANNEL_ID` - Channel where /stats command is restricted
- `NODE_ENV` - Set to `production` for production deployment

## Testing and Debugging

- Winston logger configured in `src/utils/logger.js`
- Log levels: error, warn, info, debug
- Failed events logged to `logs/dead-letter/` with full context
- Use `NODE_ENV=development` for verbose logging

## Important Notes

- The bot requires Discord privileged intents: MESSAGE CONTENT and SERVER MEMBERS
- Player identification uses Steam ID 64-bit format as primary key
- PLAYER_DIED events must be delayed to allow PLAYER_WOUNDED events to be processed first
- Weapon cache is initialized on startup from database to avoid repeated lookups
- All game events include serverID to support multi-server tracking

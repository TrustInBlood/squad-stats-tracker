const { EventEmitter } = require('events');
const logger = require('./logger');

class LogParser extends EventEmitter {
    constructor() {
        super();
        this.eventStore = {
            session: {} // Store player session data
        };
        this.setupEventPatterns();
    }

    setupEventPatterns() {
        // Kill event pattern from SquadJS
        this.patterns = {
            kill: {
                regex: /^\[([0-9.:-]+)]\[([ 0-9]*)]LogSquadTrace: \[DedicatedServer](?:ASQSoldier::)?Die\(\): Player:(.+) KillingDamage=(?:-)*([0-9.]+) from ([A-z_0-9]+) \(Online IDs:([^)|]+)\| Contoller ID: ([\w\d]+)\) caused by ([A-z_0-9-]+)_C/,
                onMatch: (args) => {
                    if (args[6].includes('INVALID')) return; // Skip invalid IDs

                    const data = {
                        ...this.eventStore.session[args[3]],
                        raw: args[0],
                        time: args[1],
                        woundTime: args[1],
                        chainID: args[2],
                        victimName: args[3],
                        damage: parseFloat(args[4]),
                        attackerPlayerController: args[5],
                        weapon: args[8],
                        attackerIDs: this.parseOnlineIDs(args[6])
                    };

                    // Store in session
                    this.eventStore.session[args[3]] = data;

                    // Emit kill event
                    this.emit('PLAYER_DIED', data);
                }
            }
        };
    }

    parseOnlineIDs(idsString) {
        const ids = {};
        const parts = idsString.split('|');
        
        for (const part of parts) {
            const [platform, id] = part.split(':').map(s => s.trim());
            if (platform && id) {
                ids[platform.toLowerCase()] = id;
            }
        }
        
        return ids;
    }

    parseLine(line) {
        if (!line) return;

        // Try each pattern
        for (const [eventName, pattern] of Object.entries(this.patterns)) {
            const match = line.match(pattern.regex);
            if (match) {
                try {
                    pattern.onMatch.call(this, match);
                } catch (error) {
                    logger.error(`Error processing ${eventName} event:`, error);
                }
                break;
            }
        }
    }

    clearSession() {
        this.eventStore.session = {};
    }
}

module.exports = LogParser; 
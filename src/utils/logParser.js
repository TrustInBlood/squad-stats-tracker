const { EventEmitter } = require('events');
const logger = require('./logger');

class LogParser extends EventEmitter {
    constructor() {
        super();
        this.eventStore = {
            session: {} // Store player session data
        };
        this.setupEventPatterns();
        this.linesParsed = 0;
        this.matchingLines = 0;
        this.lastMinuteLines = 0;
        this.lastMinuteMatches = 0;
        this.lastMinuteTime = Date.now();
        this.totalLatency = 0;

        // Start stats reporting interval
        setInterval(() => this.reportStats(), 60000);
    }

    setupEventPatterns() {
        // Kill event pattern from SquadJS
        this.patterns = {
            kill: {
                regex: /^\[([0-9.:-]+)]\[([ 0-9]*)]LogSquadTrace: \[DedicatedServer](?:ASQSoldier::)?Die\(\): Player:(.+) KillingDamage=(?:-)*([0-9.]+) from ([A-z_0-9]+) \(Online IDs:([^)|]+)\| Contoller ID: ([\w\d]+)\) caused by ([A-z_0-9-]+)_C/,
                onMatch: (args) => {
                    if (args[6].includes('INVALID')) {
                        logger.debug(`[LogParser] Skipping kill event with invalid ID: ${args[6]}`);
                        return;
                    }

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

                    // Calculate latency
                    const latency = Date.now() - new Date(args[1]).getTime();
                    this.totalLatency += latency;
                    this.matchingLines++;
                    this.lastMinuteMatches++;

                    logger.debug(`[LogParser] Parsed kill event: ${args[3]} killed by ${args[5]} with ${args[8]} (latency: ${latency}ms)`);

                    // Emit kill event
                    this.emit('PLAYER_DIED', data);
                }
            }
        };
    }

    parseLine(line) {
        if (!line) return;

        this.linesParsed++;
        this.lastMinuteLines++;
        this.emit('line_parsed', line);

        // Try each pattern
        for (const [eventName, pattern] of Object.entries(this.patterns)) {
            const match = line.match(pattern.regex);
            if (match) {
                try {
                    pattern.onMatch.call(this, match);
                } catch (error) {
                    logger.error(`[LogParser] Error processing ${eventName} event:`, error);
                }
                break;
            }
        }
    }

    reportStats() {
        const now = Date.now();
        const timeDiff = (now - this.lastMinuteTime) / 1000; // Convert to seconds
        const linesPerMinute = Math.round((this.lastMinuteLines / timeDiff) * 60);
        const matchesPerMinute = Math.round((this.lastMinuteMatches / timeDiff) * 60);
        const avgLatency = this.matchingLines > 0 ? this.totalLatency / this.matchingLines : 0;

        logger.info(`[LogParser] Stats: ${linesPerMinute} lines/min | ${matchesPerMinute} matches/min | Avg latency: ${avgLatency.toFixed(2)}ms`);

        // Reset counters
        this.lastMinuteLines = 0;
        this.lastMinuteMatches = 0;
        this.lastMinuteTime = now;
    }

    clearSession() {
        this.eventStore.session = {};
        logger.debug('[LogParser] Cleared session data');
    }

    parseOnlineIDs(onlineIDs) {
        try {
            return onlineIDs.split('|').map(id => id.trim());
        } catch (error) {
            logger.error('[LogParser] Error parsing online IDs:', error);
            return [];
        }
    }
}

module.exports = LogParser; 
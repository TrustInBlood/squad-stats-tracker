// database/player-revive.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlayerRevive = sequelize.define('PlayerRevive', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    serverID: {
      type: DataTypes.STRING(20),
      allowNull: false,
      index: true,
      comment: 'Server identifier (e.g., "server4")'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      index: true,
      comment: 'When the revive occurred'
    },
    chainID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Squad.js chain ID for event tracking'
    },
    reviverSteamID: {
      type: DataTypes.STRING(17),
      allowNull: false,
      index: true,
      comment: 'Steam ID of the player who performed the revive'
    },
    reviverEOSID: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'EOS ID of the reviver'
    },
    victimSteamID: {
      type: DataTypes.STRING(17),
      allowNull: false,
      index: true,
      comment: 'Steam ID of the player who was revived'
    },
    victimEOSID: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'EOS ID of the revived player'
    },
    woundTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the victim was originally wounded'
    },
    downTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time in seconds the player was down before revive'
    },
    reviverTeamID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Team ID of the reviver'
    },
    victimTeamID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Team ID of the revived player'
    },
    crossTeamRevive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true,
      comment: 'Whether this was a cross-team revive (unusual)'
    },
    rawData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Full Squad.js event data for debugging'
    }
  }, {
    timestamps: false, // We use our own timestamp field
    tableName: 'player_revives',
    indexes: [
      {
        name: 'idx_revive_timestamp',
        fields: ['timestamp']
      },
      {
        name: 'idx_revive_server_time',
        fields: ['serverID', 'timestamp']
      },
      {
        name: 'idx_revive_reviver_time',
        fields: ['reviverSteamID', 'timestamp']
      },
      {
        name: 'idx_revive_victim_time',
        fields: ['victimSteamID', 'timestamp']
      },
      {
        name: 'idx_revive_cross_team',
        fields: ['crossTeamRevive']
      },
      {
        name: 'idx_revive_wound_lookup',
        fields: ['victimSteamID', 'woundTime']
      },
      {
        name: 'idx_revive_daily_cleanup',
        fields: ['timestamp', 'serverID']
      }
    ]
  });

  // Class methods for creating revive records
  PlayerRevive.createFromSquadEvent = async function(eventData) {
    if (!eventData || eventData.event !== 'PLAYER_REVIVED') {
      return { revive: null, error: 'Invalid event data for PLAYER_REVIVED' };
    }

    try {
      // Calculate down time if we have wound time
      let downTime = null;
      if (eventData.data.woundTime) {
        const woundDate = new Date(eventData.data.woundTime);
        const reviveDate = new Date(eventData.timestamp);
        downTime = Math.floor((reviveDate - woundDate) / 1000); // seconds
      }

      // Check if this is a cross-team revive (unusual but possible)
      const crossTeam = eventData.data.reviver?.teamID !== eventData.data.victim?.teamID;

      const reviveRecord = await this.create({
        serverID: eventData.serverID,
        timestamp: new Date(eventData.timestamp),
        chainID: eventData.data.chainID,
        reviverSteamID: eventData.data.reviverSteamID,
        reviverEOSID: eventData.data.reviverEOSID,
        victimSteamID: eventData.data.victimSteamID,
        victimEOSID: eventData.data.victimEOSID,
        woundTime: eventData.data.woundTime ? new Date(eventData.data.woundTime) : null,
        downTime: downTime,
        reviverTeamID: eventData.data.reviver?.teamID,
        victimTeamID: eventData.data.victim?.teamID,
        crossTeamRevive: crossTeam,
        rawData: eventData.data
      });

      return { revive: reviveRecord, error: null };
    } catch (error) {
      console.error('Error creating revive record:', error);
      return { revive: null, error: error.message };
    }
  };

  // Bulk insert for high volume processing
  PlayerRevive.bulkCreateFromSquadEvents = async function(eventDataArray) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      const reviveRecords = eventDataArray
        .filter(event => event.event === 'PLAYER_REVIVED')
        .map(eventData => {
          // Calculate down time if we have wound time
          let downTime = null;
          if (eventData.data.woundTime) {
            const woundDate = new Date(eventData.data.woundTime);
            const reviveDate = new Date(eventData.timestamp);
            downTime = Math.floor((reviveDate - woundDate) / 1000);
          }

          const crossTeam = eventData.data.reviver?.teamID !== eventData.data.victim?.teamID;

          return {
            serverID: eventData.serverID,
            timestamp: new Date(eventData.timestamp),
            chainID: eventData.data.chainID,
            reviverSteamID: eventData.data.reviverSteamID,
            reviverEOSID: eventData.data.reviverEOSID,
            victimSteamID: eventData.data.victimSteamID,
            victimEOSID: eventData.data.victimEOSID,
            woundTime: eventData.data.woundTime ? new Date(eventData.data.woundTime) : null,
            downTime: downTime,
            reviverTeamID: eventData.data.reviver?.teamID,
            victimTeamID: eventData.data.victim?.teamID,
            crossTeamRevive: crossTeam,
            rawData: eventData.data
          };
        });

      if (reviveRecords.length === 0) {
        return results;
      }

      const createdRecords = await this.bulkCreate(reviveRecords, {
        ignoreDuplicates: true,
        validate: true
      });

      results.successful = createdRecords.length;
      return results;
    } catch (error) {
      console.error('Error bulk creating revive records:', error);
      results.failed = eventDataArray.length;
      results.errors.push(error.message);
      return results;
    }
  };

  // Query helpers for common analytics
  PlayerRevive.getRevivesByMedic = function(steamID, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        reviverSteamID: steamID,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      order: [['timestamp', 'DESC']]
    });
  };

  PlayerRevive.getRevivesReceived = function(steamID, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        victimSteamID: steamID,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      order: [['timestamp', 'DESC']]
    });
  };

  PlayerRevive.getMedicStats = async function(steamID, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    try {
      const revives = await this.findAll({
        where: {
          reviverSteamID: steamID,
          timestamp: {
            [sequelize.Sequelize.Op.gte]: startDate
          }
        },
        attributes: [
          [sequelize.Sequelize.fn('COUNT', '*'), 'totalRevives'],
          [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('downTime')), 'avgDownTime'],
          [sequelize.Sequelize.fn('MIN', sequelize.Sequelize.col('downTime')), 'fastestRevive'],
          [sequelize.Sequelize.fn('MAX', sequelize.Sequelize.col('downTime')), 'slowestRevive']
        ]
      });

      const crossTeamRevives = await this.count({
        where: {
          reviverSteamID: steamID,
          crossTeamRevive: true,
          timestamp: {
            [sequelize.Sequelize.Op.gte]: startDate
          }
        }
      });

      return { 
        stats: revives[0]?.dataValues || { totalRevives: 0, avgDownTime: 0, fastestRevive: 0, slowestRevive: 0 },
        crossTeamRevives,
        error: null 
      };
    } catch (error) {
      console.error('Error calculating medic stats:', error);
      return { stats: null, crossTeamRevives: 0, error: error.message };
    }
  };

  PlayerRevive.getTopMedics = function(days, limit) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      attributes: [
        'reviverSteamID',
        [sequelize.Sequelize.fn('COUNT', '*'), 'reviveCount'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('downTime')), 'avgDownTime']
      ],
      group: ['reviverSteamID'],
      order: [[sequelize.Sequelize.literal('reviveCount'), 'DESC']],
      limit: limit || 10
    });
  };

  PlayerRevive.getFastestMedics = function(days, limit) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        },
        downTime: {
          [sequelize.Sequelize.Op.not]: null
        }
      },
      attributes: [
        'reviverSteamID',
        [sequelize.Sequelize.fn('COUNT', '*'), 'reviveCount'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('downTime')), 'avgDownTime']
      ],
      group: ['reviverSteamID'],
      having: sequelize.Sequelize.literal('COUNT(*) >= 5'), // At least 5 revives for meaningful average
      order: [[sequelize.Sequelize.literal('avgDownTime'), 'ASC']],
      limit: limit || 10
    });
  };

  PlayerRevive.getReviveEfficiency = async function(days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    try {
      // This would need to be cross-referenced with PlayerWound model
      // For now, just return revive stats
      const stats = await this.findAll({
        where: {
          timestamp: {
            [sequelize.Sequelize.Op.gte]: startDate
          }
        },
        attributes: [
          [sequelize.Sequelize.fn('COUNT', '*'), 'totalRevives'],
          [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('downTime')), 'avgDownTime'],
          [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN crossTeamRevive = true THEN 1 END')), 'crossTeamRevives']
        ]
      });

      return { stats: stats[0]?.dataValues, error: null };
    } catch (error) {
      console.error('Error calculating revive efficiency:', error);
      return { stats: null, error: error.message };
    }
  };

  PlayerRevive.getCrossTeamRevives = function(days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        crossTeamRevive: true,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      order: [['timestamp', 'DESC']]
    });
  };

  // Helper to update PlayerWound records when revive occurs
  PlayerRevive.updateWoundRecord = async function(reviveData) {
    if (!reviveData.woundTime || !reviveData.victimSteamID) {
      return { updated: false, error: 'Missing wound time or victim ID' };
    }

    try {
      // This would require importing PlayerWound model
      // For now, return a placeholder
      return { updated: true, error: null };
    } catch (error) {
      console.error('Error updating wound record:', error);
      return { updated: false, error: error.message };
    }
  };

  // Cleanup old records
  PlayerRevive.cleanupOldRecords = async function(daysToKeep) {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    try {
      const deletedCount = await this.destroy({
        where: {
          timestamp: {
            [sequelize.Sequelize.Op.lt]: cutoffDate
          }
        }
      });

      return { deletedCount, error: null };
    } catch (error) {
      console.error('Error cleaning up old revive records:', error);
      return { deletedCount: 0, error: error.message };
    }
  };

  return PlayerRevive;
};
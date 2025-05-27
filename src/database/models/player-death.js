// database/player-death.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlayerDeath = sequelize.define('PlayerDeath', {
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
      comment: 'When the death occurred'
    },
    chainID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Squad.js chain ID for event tracking'
    },
    damage: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Killing damage amount (usually 300)'
    },
    weapon: {
      type: DataTypes.STRING(100),
      allowNull: true,
      index: true,
      comment: 'Weapon that caused the death (e.g., "BP_Projectile_76mm_Frag")'
    },
    attackerSteamID: {
      type: DataTypes.STRING(17),
      allowNull: true,
      index: true,
      comment: 'Steam ID of the killer (null for suicide/environment)'
    },
    attackerEOSID: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'EOS ID of the killer'
    },
    victimSteamID: {
      type: DataTypes.STRING(17),
      allowNull: true,
      index: true,
      comment: 'Steam ID of the victim (null for environmental death)'
    },
    victimEOSID: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'EOS ID of the victim (null for environmental death)'
    },
    woundTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the victim was initially wounded'
    },
    teamkill: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true,
      comment: 'Whether this was friendly fire'
    },
    attackerTeamID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Team ID of the killer'
    },
    victimTeamID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Team ID of the victim (null for environmental death)'
    },
    rawData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Full Squad.js event data for debugging'
    }
  }, {
    timestamps: false, // We use our own timestamp field
    tableName: 'player_deaths',
    indexes: [
      {
        name: 'idx_death_timestamp',
        fields: ['timestamp']
      },
      {
        name: 'idx_death_server_time',
        fields: ['serverID', 'timestamp']
      },
      {
        name: 'idx_death_attacker_time',
        fields: ['attackerSteamID', 'timestamp']
      },
      {
        name: 'idx_death_victim_time',
        fields: ['victimSteamID', 'timestamp']
      },
      {
        name: 'idx_death_weapon',
        fields: ['weapon']
      },
      {
        name: 'idx_death_teamkill',
        fields: ['teamkill']
      },
      {
        name: 'idx_death_daily_cleanup',
        fields: ['timestamp', 'serverID']
      }
    ]
  });

  // Class methods for creating death records
  PlayerDeath.createFromSquadEvent = async function(eventData) {
    if (!eventData || eventData.event !== 'PLAYER_DIED') {
      return { death: null, error: 'Invalid event data for PLAYER_DIED' };
    }

    try {
      const deathRecord = await this.create({
        serverID: eventData.serverID,
        timestamp: new Date(eventData.timestamp),
        chainID: eventData.data.chainID,
        damage: eventData.data.damage,
        weapon: eventData.data.weapon,
        attackerSteamID: eventData.data.attackerSteamID,
        attackerEOSID: eventData.data.attackerEOSID,
        victimSteamID: eventData.data.victim?.steamID,
        victimEOSID: eventData.data.victim?.eosID,
        woundTime: eventData.data.woundTime ? new Date(eventData.data.woundTime) : null,
        teamkill: eventData.data.teamkill || false,
        attackerTeamID: eventData.data.attacker?.teamID,
        victimTeamID: eventData.data.victim?.teamID,
        rawData: eventData.data
      });

      return { death: deathRecord, error: null };
    } catch (error) {
      console.error('Error creating death record:', error);
      return { death: null, error: error.message };
    }
  };

  // Bulk insert for high volume processing
  PlayerDeath.bulkCreateFromSquadEvents = async function(eventDataArray) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      const deathRecords = eventDataArray
        .filter(event => event.event === 'PLAYER_DIED')
        .map(eventData => ({
          serverID: eventData.serverID,
          timestamp: new Date(eventData.timestamp),
          chainID: eventData.data.chainID,
          damage: eventData.data.damage,
          weapon: eventData.data.weapon,
          attackerSteamID: eventData.data.attackerSteamID,
          attackerEOSID: eventData.data.attackerEOSID,
          victimSteamID: eventData.data.victim?.steamID,
          victimEOSID: eventData.data.victim?.eosID,
          woundTime: eventData.data.woundTime ? new Date(eventData.data.woundTime) : null,
          teamkill: eventData.data.teamkill || false,
          attackerTeamID: eventData.data.attacker?.teamID,
          victimTeamID: eventData.data.victim?.teamID,
          rawData: eventData.data
        }));

      if (deathRecords.length === 0) {
        return results;
      }

      const createdRecords = await this.bulkCreate(deathRecords, {
        ignoreDuplicates: true,
        validate: true
      });

      results.successful = createdRecords.length;
      return results;
    } catch (error) {
      console.error('Error bulk creating death records:', error);
      results.failed = eventDataArray.length;
      results.errors.push(error.message);
      return results;
    }
  };

  // Query helpers for common analytics
  PlayerDeath.getKillsByPlayer = function(steamID, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        attackerSteamID: steamID,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      order: [['timestamp', 'DESC']]
    });
  };

  PlayerDeath.getDeathsByPlayer = function(steamID, days) {
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

  PlayerDeath.getKDRatio = async function(steamID, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    try {
      const kills = await this.count({
        where: {
          attackerSteamID: steamID,
          timestamp: {
            [sequelize.Sequelize.Op.gte]: startDate
          }
        }
      });

      const deaths = await this.count({
        where: {
          victimSteamID: steamID,
          timestamp: {
            [sequelize.Sequelize.Op.gte]: startDate
          }
        }
      });

      const ratio = deaths > 0 ? (kills / deaths) : kills;
      
      return { kills, deaths, ratio, error: null };
    } catch (error) {
      console.error('Error calculating K/D ratio:', error);
      return { kills: 0, deaths: 0, ratio: 0, error: error.message };
    }
  };

  PlayerDeath.getTeamkillsByPlayer = function(steamID, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        attackerSteamID: steamID,
        teamkill: true,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      order: [['timestamp', 'DESC']]
    });
  };

  PlayerDeath.getTopKillers = function(days, limit) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        },
        attackerSteamID: {
          [sequelize.Sequelize.Op.not]: null
        }
      },
      attributes: [
        'attackerSteamID',
        [sequelize.Sequelize.fn('COUNT', '*'), 'killCount']
      ],
      group: ['attackerSteamID'],
      order: [[sequelize.Sequelize.literal('killCount'), 'DESC']],
      limit: limit || 10
    });
  };

  PlayerDeath.getWeaponKillStats = function(weapon, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        weapon,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      attributes: [
        'weapon',
        [sequelize.Sequelize.fn('COUNT', '*'), 'killCount'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN teamkill = true THEN 1 END')), 'teamkillCount']
      ],
      group: ['weapon']
    });
  };

  // Cleanup old records
  PlayerDeath.cleanupOldRecords = async function(daysToKeep) {
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
      console.error('Error cleaning up old death records:', error);
      return { deletedCount: 0, error: error.message };
    }
  };

  return PlayerDeath;
};
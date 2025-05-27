// database/player-wound.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlayerWound = sequelize.define('PlayerWound', {
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
      comment: 'When the player was wounded/downed'
    },
    chainID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Squad.js chain ID for event tracking'
    },
    damage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: 'Damage amount that caused the wound'
    },
    damageType: {
      type: DataTypes.ENUM('player', 'environment', 'vehicle', 'unknown'),
      allowNull: false,
      defaultValue: 'unknown',
      index: true,
      comment: 'Type of damage (player, environment, vehicle, or unknown)'
    },
    weapon: {
      type: DataTypes.STRING(100),
      allowNull: true,
      index: true,
      comment: 'Weapon that caused the wound (e.g., "BP_Projectile_76mm_Frag")'
    },
    attackerSteamID: {
      type: DataTypes.STRING(17),
      allowNull: true,
      index: true,
      comment: 'Steam ID of the attacker (null for environment damage)'
    },
    attackerEOSID: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'EOS ID of the attacker'
    },
    victimSteamID: {
      type: DataTypes.STRING(17),
      allowNull: true,
      index: true,
      comment: 'Steam ID of the victim (null for environmental damage)'
    },
    victimEOSID: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'EOS ID of the victim (null for environmental damage)'
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
      comment: 'Team ID of the attacker'
    },
    victimTeamID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Team ID of the victim (null for environmental damage)'
    },
    wasRevived: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      index: true,
      comment: 'Whether this wound was later revived (null = unknown/pending)'
    },
    wasDead: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      index: true,
      comment: 'Whether this wound resulted in death (null = unknown/pending)'
    },
    rawData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Full Squad.js event data for debugging'
    }
  }, {
    timestamps: false, // We use our own timestamp field
    tableName: 'player_wounds',
    indexes: [
      {
        name: 'idx_wound_timestamp',
        fields: ['timestamp']
      },
      {
        name: 'idx_wound_server_time',
        fields: ['serverID', 'timestamp']
      },
      {
        name: 'idx_wound_attacker_time',
        fields: ['attackerSteamID', 'timestamp']
      },
      {
        name: 'idx_wound_victim_time',
        fields: ['victimSteamID', 'timestamp']
      },
      {
        name: 'idx_wound_weapon',
        fields: ['weapon']
      },
      {
        name: 'idx_wound_teamkill',
        fields: ['teamkill']
      },
      {
        name: 'idx_wound_outcome',
        fields: ['wasRevived', 'wasDead']
      },
      {
        name: 'idx_wound_daily_cleanup',
        fields: ['timestamp', 'serverID']
      },
      {
        name: 'idx_wound_damage_type',
        fields: ['damageType']
      }
    ]
  });

  // Class methods for creating wound records
  PlayerWound.createFromSquadEvent = async function(eventData) {
    if (!eventData || eventData.event !== 'PLAYER_WOUNDED') {
      return { wound: null, error: 'Invalid event data for PLAYER_WOUNDED' };
    }

    try {
      // Determine damage type
      let damageType = 'unknown';
      if (!eventData.data.victim) {
        damageType = 'environment';
      } else if (eventData.data.attacker?.isVehicle) {
        damageType = 'vehicle';
      } else if (eventData.data.attacker?.steamID) {
        damageType = 'player';
      }

      const woundRecord = await this.create({
        serverID: eventData.serverID,
        timestamp: new Date(eventData.timestamp),
        chainID: eventData.data.chainID,
        damage: eventData.data.damage,
        damageType: damageType,
        weapon: eventData.data.weapon,
        attackerSteamID: eventData.data.attackerSteamID,
        attackerEOSID: eventData.data.attackerEOSID,
        victimSteamID: eventData.data.victim?.steamID,
        victimEOSID: eventData.data.victim?.eosID,
        teamkill: eventData.data.teamkill || false,
        attackerTeamID: eventData.data.attacker?.teamID,
        victimTeamID: eventData.data.victim?.teamID,
        wasRevived: null,
        wasDead: null,
        rawData: eventData.data
      });

      return { wound: woundRecord, error: null };
    } catch (error) {
      console.error('Error creating wound record:', error);
      return { wound: null, error: error.message };
    }
  };

  // Bulk insert for high volume processing
  PlayerWound.bulkCreateFromSquadEvents = async function(eventDataArray) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      const woundRecords = eventDataArray
        .filter(event => event.event === 'PLAYER_WOUNDED')
        .map(eventData => {
          // Determine damage type
          let damageType = 'unknown';
          if (!eventData.data.victim) {
            damageType = 'environment';
          } else if (eventData.data.attacker?.isVehicle) {
            damageType = 'vehicle';
          } else if (eventData.data.attacker?.steamID) {
            damageType = 'player';
          }

          return {
            serverID: eventData.serverID,
            timestamp: new Date(eventData.timestamp),
            chainID: eventData.data.chainID,
            damage: eventData.data.damage,
            damageType: damageType,
            weapon: eventData.data.weapon,
            attackerSteamID: eventData.data.attackerSteamID,
            attackerEOSID: eventData.data.attackerEOSID,
            victimSteamID: eventData.data.victim?.steamID,
            victimEOSID: eventData.data.victim?.eosID,
            teamkill: eventData.data.teamkill || false,
            attackerTeamID: eventData.data.attacker?.teamID,
            victimTeamID: eventData.data.victim?.teamID,
            wasRevived: null,
            wasDead: null,
            rawData: eventData.data
          };
        });

      if (woundRecords.length === 0) {
        return results;
      }

      const createdRecords = await this.bulkCreate(woundRecords, {
        ignoreDuplicates: true,
        validate: true
      });

      results.successful = createdRecords.length;
      return results;
    } catch (error) {
      console.error('Error bulk creating wound records:', error);
      results.failed = eventDataArray.length;
      results.errors.push(error.message);
      return results;
    }
  };

  // Update wound outcome when we see revive/death events
  PlayerWound.markAsRevived = async function(victimSteamID, woundTime) {
    try {
      const updated = await this.update(
        { wasRevived: true, wasDead: false },
        {
          where: {
            victimSteamID,
            timestamp: woundTime,
            wasRevived: null,
            wasDead: null
          }
        }
      );

      return { updated: updated[0], error: null };
    } catch (error) {
      console.error('Error marking wound as revived:', error);
      return { updated: 0, error: error.message };
    }
  };

  PlayerWound.markAsDead = async function(victimSteamID, woundTime) {
    try {
      const updated = await this.update(
        { wasDead: true, wasRevived: false },
        {
          where: {
            victimSteamID,
            timestamp: woundTime,
            wasRevived: null,
            wasDead: null
          }
        }
      );

      return { updated: updated[0], error: null };
    } catch (error) {
      console.error('Error marking wound as dead:', error);
      return { updated: 0, error: error.message };
    }
  };

  // Query helpers for common analytics
  PlayerWound.getWoundsByPlayer = function(steamID, days) {
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

  PlayerWound.getWoundedByPlayer = function(steamID, days) {
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

  PlayerWound.getReviveRate = async function(steamID, days) {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    try {
      const totalWounds = await this.count({
        where: {
          victimSteamID: steamID,
          timestamp: {
            [sequelize.Sequelize.Op.gte]: startDate
          },
          wasRevived: {
            [sequelize.Sequelize.Op.not]: null
          }
        }
      });

      const revived = await this.count({
        where: {
          victimSteamID: steamID,
          wasRevived: true,
          timestamp: {
            [sequelize.Sequelize.Op.gte]: startDate
          }
        }
      });

      const reviveRate = totalWounds > 0 ? (revived / totalWounds) * 100 : 0;
      
      return { totalWounds, revived, reviveRate, error: null };
    } catch (error) {
      console.error('Error calculating revive rate:', error);
      return { totalWounds: 0, revived: 0, reviveRate: 0, error: error.message };
    }
  };

  PlayerWound.getTeamWoundsByPlayer = function(steamID, days) {
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

  PlayerWound.getWeaponWoundStats = function(weapon, days) {
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
        [sequelize.Sequelize.fn('COUNT', '*'), 'woundCount'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('damage')), 'avgDamage'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN wasRevived = true THEN 1 END')), 'revivedCount'],
        [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.literal('CASE WHEN wasDead = true THEN 1 END')), 'deathCount']
      ],
      group: ['weapon']
    });
  };

  // Get pending wounds (no outcome yet)
  PlayerWound.getPendingWounds = function(maxAgeMinutes) {
    const cutoffTime = new Date(Date.now() - (maxAgeMinutes * 60 * 1000));
    
    return this.findAll({
      where: {
        wasRevived: null,
        wasDead: null,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: cutoffTime
        }
      },
      order: [['timestamp', 'ASC']]
    });
  };

  // Cleanup old records
  PlayerWound.cleanupOldRecords = async function(daysToKeep) {
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
      console.error('Error cleaning up old wound records:', error);
      return { deletedCount: 0, error: error.message };
    }
  };

  return PlayerWound;
};
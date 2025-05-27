// database/player-damage.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlayerDamage = sequelize.define('PlayerDamage', {
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
      comment: 'When the damage occurred'
    },
    chainID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Squad.js chain ID for event tracking'
    },
    damage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: 'Amount of damage dealt'
    },
    weapon: {
      type: DataTypes.STRING(100),
      allowNull: true,
      index: true,
      comment: 'Weapon that caused the damage (e.g., "BP_Mortarround4")'
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
      allowNull: false,
      index: true,
      comment: 'Steam ID of the victim'
    },
    victimEOSID: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'EOS ID of the victim'
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
      allowNull: false,
      comment: 'Team ID of the victim'
    },
    rawData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Full Squad.js event data for debugging'
    }
  }, {
    timestamps: false, // We use our own timestamp field
    tableName: 'player_damage',
    indexes: [
      {
        name: 'idx_damage_timestamp',
        fields: ['timestamp']
      },
      {
        name: 'idx_damage_server_time',
        fields: ['serverID', 'timestamp']
      },
      {
        name: 'idx_damage_attacker_time',
        fields: ['attackerSteamID', 'timestamp']
      },
      {
        name: 'idx_damage_victim_time',
        fields: ['victimSteamID', 'timestamp']
      },
      {
        name: 'idx_damage_weapon',
        fields: ['weapon']
      },
      {
        name: 'idx_damage_teamkill',
        fields: ['teamkill']
      },
      {
        name: 'idx_damage_daily_cleanup',
        fields: ['timestamp', 'serverID'] // For efficient daily cleanup
      }
    ]
  });

  // Class methods for creating damage records
  PlayerDamage.createFromSquadEvent = async function(eventData) {
    if (!eventData || eventData.event !== 'PLAYER_DAMAGED') {
      return { damage: null, error: 'Invalid event data for PLAYER_DAMAGED' };
    }

    try {
      const damageRecord = await this.create({
        serverID: eventData.serverID,
        timestamp: new Date(eventData.timestamp),
        chainID: eventData.data.chainID,
        damage: eventData.data.damage,
        weapon: eventData.data.weapon,
        attackerSteamID: eventData.data.attackerSteamID,
        attackerEOSID: eventData.data.attackerEOSID,
        victimSteamID: eventData.data.victim?.steamID,
        victimEOSID: eventData.data.victim?.eosID,
        teamkill: eventData.data.teamkill || false,
        attackerTeamID: eventData.data.attacker?.teamID,
        victimTeamID: eventData.data.victim?.teamID,
        rawData: eventData.data
      });

      return { damage: damageRecord, error: null };
    } catch (error) {
      console.error('Error creating damage record:', error);
      return { damage: null, error: error.message };
    }
  };

  // Bulk insert for high volume processing
  PlayerDamage.bulkCreateFromSquadEvents = async function(eventDataArray) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      const damageRecords = eventDataArray
        .filter(event => event.event === 'PLAYER_DAMAGED')
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
          teamkill: eventData.data.teamkill || false,
          attackerTeamID: eventData.data.attacker?.teamID,
          victimTeamID: eventData.data.victim?.teamID,
          rawData: eventData.data
        }));

      if (damageRecords.length === 0) {
        return results;
      }

      const createdRecords = await this.bulkCreate(damageRecords, {
        ignoreDuplicates: true, // Skip duplicates instead of erroring
        validate: true
      });

      results.successful = createdRecords.length;
      return results;
    } catch (error) {
      console.error('Error bulk creating damage records:', error);
      results.failed = eventDataArray.length;
      results.errors.push(error.message);
      return results;
    }
  };

  // Query helpers for common analytics
  PlayerDamage.getDamageByPlayer = function(steamID, startDate = null, endDate = null) {
    const where = {
      [sequelize.Sequelize.Op.or]: [
        { attackerSteamID: steamID },
        { victimSteamID: steamID }
      ]
    };

    if (startDate && endDate) {
      where.timestamp = {
        [sequelize.Sequelize.Op.between]: [startDate, endDate]
      };
    }

    return this.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: 1000 // Prevent huge queries
    });
  };

  PlayerDamage.getTeamkillsByPlayer = function(steamID, days) {
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

  PlayerDamage.getWeaponStats = function(weapon, days) {
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
        [sequelize.Sequelize.fn('COUNT', '*'), 'hitCount'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('damage')), 'avgDamage'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('damage')), 'totalDamage']
      ],
      group: ['weapon']
    });
  };

  // Cleanup old records
  PlayerDamage.cleanupOldRecords = async function(daysToKeep) {
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
      console.error('Error cleaning up old damage records:', error);
      return { deletedCount: 0, error: error.message };
    }
  };

  return PlayerDamage;
};
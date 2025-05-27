'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('player_damage', {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      serverID: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Server identifier (e.g., "server4")'
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
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
        comment: 'Weapon that caused the damage (e.g., "BP_Mortarround4")'
      },
      attackerSteamID: {
        type: DataTypes.STRING(17),
        allowNull: true,
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
    });

    // Add indexes
    await queryInterface.addIndex('player_damage', ['timestamp'], {
      name: 'idx_damage_timestamp'
    });

    await queryInterface.addIndex('player_damage', ['serverID', 'timestamp'], {
      name: 'idx_damage_server_time'
    });

    await queryInterface.addIndex('player_damage', ['attackerSteamID', 'timestamp'], {
      name: 'idx_damage_attacker_time'
    });

    await queryInterface.addIndex('player_damage', ['victimSteamID', 'timestamp'], {
      name: 'idx_damage_victim_time'
    });

    await queryInterface.addIndex('player_damage', ['weapon'], {
      name: 'idx_damage_weapon'
    });

    await queryInterface.addIndex('player_damage', ['teamkill'], {
      name: 'idx_damage_teamkill'
    });

    await queryInterface.addIndex('player_damage', ['timestamp', 'serverID'], {
      name: 'idx_damage_daily_cleanup'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('player_damage', 'idx_damage_timestamp');
    await queryInterface.removeIndex('player_damage', 'idx_damage_server_time');
    await queryInterface.removeIndex('player_damage', 'idx_damage_attacker_time');
    await queryInterface.removeIndex('player_damage', 'idx_damage_victim_time');
    await queryInterface.removeIndex('player_damage', 'idx_damage_weapon');
    await queryInterface.removeIndex('player_damage', 'idx_damage_teamkill');
    await queryInterface.removeIndex('player_damage', 'idx_damage_daily_cleanup');

    // Then remove the table
    await queryInterface.dropTable('player_damage');
  }
};

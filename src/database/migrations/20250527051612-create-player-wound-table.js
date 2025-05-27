'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('player_wound', {
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
        comment: 'When the wound occurred'
      },
      chainID: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Squad.js chain ID for event tracking'
      },
      weapon: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Weapon that caused the wound (e.g., "BP_Mortarround4")'
      },
      attackerSteamID: {
        type: DataTypes.STRING(17),
        allowNull: true,
        comment: 'Steam ID of the attacker (null for environment wound)'
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
    await queryInterface.addIndex('player_wound', ['timestamp'], {
      name: 'idx_wound_timestamp'
    });

    await queryInterface.addIndex('player_wound', ['serverID', 'timestamp'], {
      name: 'idx_wound_server_time'
    });

    await queryInterface.addIndex('player_wound', ['attackerSteamID', 'timestamp'], {
      name: 'idx_wound_attacker_time'
    });

    await queryInterface.addIndex('player_wound', ['victimSteamID', 'timestamp'], {
      name: 'idx_wound_victim_time'
    });

    await queryInterface.addIndex('player_wound', ['weapon'], {
      name: 'idx_wound_weapon'
    });

    await queryInterface.addIndex('player_wound', ['teamkill'], {
      name: 'idx_wound_teamkill'
    });

    await queryInterface.addIndex('player_wound', ['timestamp', 'serverID'], {
      name: 'idx_wound_daily_cleanup'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('player_wound', 'idx_wound_timestamp');
    await queryInterface.removeIndex('player_wound', 'idx_wound_server_time');
    await queryInterface.removeIndex('player_wound', 'idx_wound_attacker_time');
    await queryInterface.removeIndex('player_wound', 'idx_wound_victim_time');
    await queryInterface.removeIndex('player_wound', 'idx_wound_weapon');
    await queryInterface.removeIndex('player_wound', 'idx_wound_teamkill');
    await queryInterface.removeIndex('player_wound', 'idx_wound_daily_cleanup');

    // Then remove the table
    await queryInterface.dropTable('player_wound');
  }
};

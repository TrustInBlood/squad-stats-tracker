'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, drop the existing table
    await queryInterface.dropTable('player_death');

    // Then recreate it with the new schema
    await queryInterface.createTable('player_deaths', {
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
        comment: 'When the death occurred'
      },
      chainID: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Squad.js chain ID for event tracking'
      },
      damageType: {
        type: DataTypes.ENUM('player', 'environment', 'vehicle', 'unknown'),
        allowNull: false,
        defaultValue: 'unknown',
        comment: 'Type of damage that caused death (player, environment, vehicle, or unknown)'
      },
      weapon: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Weapon that caused the death (e.g., "BP_Mortarround4")'
      },
      attackerSteamID: {
        type: DataTypes.STRING(17),
        allowNull: true,
        comment: 'Steam ID of the attacker (null for environment death)'
      },
      attackerEOSID: {
        type: DataTypes.STRING(32),
        allowNull: true,
        comment: 'EOS ID of the attacker'
      },
      victimSteamID: {
        type: DataTypes.STRING(17),
        allowNull: true,
        comment: 'Steam ID of the victim (null for environment death)'
      },
      victimEOSID: {
        type: DataTypes.STRING(32),
        allowNull: true,
        comment: 'EOS ID of the victim (null for environment death)'
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
        allowNull: true,
        comment: 'Team ID of the victim (null for environment death)'
      },
      rawData: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Full Squad.js event data for debugging'
      }
    });

    // Add indexes
    await queryInterface.addIndex('player_deaths', ['timestamp'], {
      name: 'idx_death_timestamp'
    });

    await queryInterface.addIndex('player_deaths', ['serverID', 'timestamp'], {
      name: 'idx_death_server_time'
    });

    await queryInterface.addIndex('player_deaths', ['attackerSteamID', 'timestamp'], {
      name: 'idx_death_attacker_time'
    });

    await queryInterface.addIndex('player_deaths', ['victimSteamID', 'timestamp'], {
      name: 'idx_death_victim_time'
    });

    await queryInterface.addIndex('player_deaths', ['weapon'], {
      name: 'idx_death_weapon'
    });

    await queryInterface.addIndex('player_deaths', ['teamkill'], {
      name: 'idx_death_teamkill'
    });

    await queryInterface.addIndex('player_deaths', ['damageType'], {
      name: 'idx_death_type'
    });

    await queryInterface.addIndex('player_deaths', ['timestamp', 'serverID'], {
      name: 'idx_death_daily_cleanup'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('player_deaths', 'idx_death_timestamp');
    await queryInterface.removeIndex('player_deaths', 'idx_death_server_time');
    await queryInterface.removeIndex('player_deaths', 'idx_death_attacker_time');
    await queryInterface.removeIndex('player_deaths', 'idx_death_victim_time');
    await queryInterface.removeIndex('player_deaths', 'idx_death_weapon');
    await queryInterface.removeIndex('player_deaths', 'idx_death_teamkill');
    await queryInterface.removeIndex('player_deaths', 'idx_death_type');
    await queryInterface.removeIndex('player_deaths', 'idx_death_daily_cleanup');

    // Then remove the table
    await queryInterface.dropTable('player_deaths');
  }
}; 
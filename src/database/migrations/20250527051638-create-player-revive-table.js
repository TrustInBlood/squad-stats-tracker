'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('player_revives', {
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
        comment: 'Steam ID of the player who performed the revive'
      },
      reviverEOSID: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: 'EOS ID of the player who performed the revive'
      },
      revivedSteamID: {
        type: DataTypes.STRING(17),
        allowNull: false,
        comment: 'Steam ID of the player who was revived'
      },
      revivedEOSID: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: 'EOS ID of the player who was revived'
      },
      reviverTeamID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Team ID of the reviver'
      },
      revivedTeamID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Team ID of the revived player'
      },
      rawData: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Full Squad.js event data for debugging'
      }
    });

    // Add indexes
    await queryInterface.addIndex('player_revives', ['timestamp'], {
      name: 'idx_revive_timestamp'
    });

    await queryInterface.addIndex('player_revives', ['serverID', 'timestamp'], {
      name: 'idx_revive_server_time'
    });

    await queryInterface.addIndex('player_revives', ['reviverSteamID', 'timestamp'], {
      name: 'idx_revive_reviver_time'
    });

    await queryInterface.addIndex('player_revives', ['revivedSteamID', 'timestamp'], {
      name: 'idx_revive_revived_time'
    });

    await queryInterface.addIndex('player_revives', ['timestamp', 'serverID'], {
      name: 'idx_revive_daily_cleanup'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('player_revives', 'idx_revive_timestamp');
    await queryInterface.removeIndex('player_revives', 'idx_revive_server_time');
    await queryInterface.removeIndex('player_revives', 'idx_revive_reviver_time');
    await queryInterface.removeIndex('player_revives', 'idx_revive_revived_time');
    await queryInterface.removeIndex('player_revives', 'idx_revive_daily_cleanup');

    // Then remove the table
    await queryInterface.dropTable('player_revives');
  }
};

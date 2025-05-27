'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('player_revive', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      serverID: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Server identifier (e.g., "server4")'
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the revive occurred'
      },
      chainID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Squad.js chain ID for event tracking'
      },
      reviverSteamID: {
        type: Sequelize.STRING(17),
        allowNull: false,
        comment: 'Steam ID of the player who performed the revive'
      },
      reviverEOSID: {
        type: Sequelize.STRING(32),
        allowNull: false,
        comment: 'EOS ID of the player who performed the revive'
      },
      revivedSteamID: {
        type: Sequelize.STRING(17),
        allowNull: false,
        comment: 'Steam ID of the player who was revived'
      },
      revivedEOSID: {
        type: Sequelize.STRING(32),
        allowNull: false,
        comment: 'EOS ID of the player who was revived'
      },
      reviverTeamID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Team ID of the reviver'
      },
      revivedTeamID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Team ID of the revived player'
      },
      rawData: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Full Squad.js event data for debugging'
      }
    });

    // Add indexes
    await queryInterface.addIndex('player_revive', ['timestamp'], {
      name: 'idx_revive_timestamp'
    });

    await queryInterface.addIndex('player_revive', ['serverID', 'timestamp'], {
      name: 'idx_revive_server_time'
    });

    await queryInterface.addIndex('player_revive', ['reviverSteamID', 'timestamp'], {
      name: 'idx_revive_reviver_time'
    });

    await queryInterface.addIndex('player_revive', ['revivedSteamID', 'timestamp'], {
      name: 'idx_revive_revived_time'
    });

    await queryInterface.addIndex('player_revive', ['timestamp', 'serverID'], {
      name: 'idx_revive_daily_cleanup'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('player_revive', 'idx_revive_timestamp');
    await queryInterface.removeIndex('player_revive', 'idx_revive_server_time');
    await queryInterface.removeIndex('player_revive', 'idx_revive_reviver_time');
    await queryInterface.removeIndex('player_revive', 'idx_revive_revived_time');
    await queryInterface.removeIndex('player_revive', 'idx_revive_daily_cleanup');

    // Then remove the table
    await queryInterface.dropTable('player_revive');
  }
};

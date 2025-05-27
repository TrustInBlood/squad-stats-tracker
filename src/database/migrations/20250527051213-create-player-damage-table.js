'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('player_damage', {
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
        comment: 'When the damage occurred'
      },
      chainID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Squad.js chain ID for event tracking'
      },
      damage: {
        type: Sequelize.FLOAT,
        allowNull: false,
        comment: 'Amount of damage dealt'
      },
      weapon: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Weapon that caused the damage (e.g., "BP_Mortarround4")'
      },
      attackerSteamID: {
        type: Sequelize.STRING(17),
        allowNull: true,
        comment: 'Steam ID of the attacker (null for environment damage)'
      },
      attackerEOSID: {
        type: Sequelize.STRING(32),
        allowNull: true,
        comment: 'EOS ID of the attacker'
      },
      victimSteamID: {
        type: Sequelize.STRING(17),
        allowNull: false,
        comment: 'Steam ID of the victim'
      },
      victimEOSID: {
        type: Sequelize.STRING(32),
        allowNull: false,
        comment: 'EOS ID of the victim'
      },
      teamkill: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this was friendly fire'
      },
      attackerTeamID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Team ID of the attacker'
      },
      victimTeamID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Team ID of the victim'
      },
      rawData: {
        type: Sequelize.JSON,
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

'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('players', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      steamID: {
        type: DataTypes.STRING(17),
        allowNull: false,
        unique: true,
        comment: 'Steam ID (e.g., 76561198846542116)'
      },
      eosID: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
        comment: 'Epic Online Services ID (e.g., 000282ef021a48bea43ea1ebe9c0e0eb)'
      },
      lastKnownName: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Last known player name in game'
      },
      firstSeen: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'When we first saw this player'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this player record is active'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Add indexes
    await queryInterface.addIndex('players', ['steamID'], {
      name: 'idx_player_steam_id'
    });

    await queryInterface.addIndex('players', ['eosID'], {
      name: 'idx_player_eos_id'
    });

    await queryInterface.addIndex('players', ['isActive'], {
      name: 'idx_player_active'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('players', 'idx_player_steam_id');
    await queryInterface.removeIndex('players', 'idx_player_eos_id');
    await queryInterface.removeIndex('players', 'idx_player_active');

    // Then remove the table
    await queryInterface.dropTable('players');
  }
};

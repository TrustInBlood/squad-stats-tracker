'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('players', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      steamID: {
        type: Sequelize.STRING(17),
        allowNull: false,
        unique: true,
        comment: 'Steam ID (e.g., 76561198846542116)'
      },
      eosID: {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
        comment: 'Epic Online Services ID (e.g., 000282ef021a48bea43ea1ebe9c0e0eb)'
      },
      lastKnownName: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Last known player name in game'
      },
      firstSeen: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: 'When we first saw this player'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this player record is active'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
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

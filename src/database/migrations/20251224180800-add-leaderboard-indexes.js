'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Kills indexes for leaderboard queries
    await queryInterface.addIndex('kills', ['created_at', 'attacker_id'], {
      name: 'idx_kills_created_at_attacker'
    });
    await queryInterface.addIndex('kills', ['weapon_id', 'created_at'], {
      name: 'idx_kills_weapon_created_at'
    });

    // Revives index for top revivers query
    await queryInterface.addIndex('revives', ['created_at', 'reviver_id'], {
      name: 'idx_revives_created_at_reviver'
    });

    // Player wounded index for cleanup DELETE query
    await queryInterface.addIndex('player_wounded', ['created_at'], {
      name: 'idx_player_wounded_created_at'
    });

    // Players index for new player count query
    await queryInterface.addIndex('players', ['created_at'], {
      name: 'idx_players_created_at'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('kills', 'idx_kills_created_at_attacker');
    await queryInterface.removeIndex('kills', 'idx_kills_weapon_created_at');
    await queryInterface.removeIndex('revives', 'idx_revives_created_at_reviver');
    await queryInterface.removeIndex('player_wounded', 'idx_player_wounded_created_at');
    await queryInterface.removeIndex('players', 'idx_players_created_at');
  }
};

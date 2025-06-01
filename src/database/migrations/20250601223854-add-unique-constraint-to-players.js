'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, let's identify and handle duplicates
    // We'll keep the most recent record for each steam_id
    await queryInterface.sequelize.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2
      WHERE p1.steam_id = p2.steam_id
      AND p1.id < p2.id;
    `);

    // Now add the unique constraint
    await queryInterface.addConstraint('players', {
      fields: ['steam_id'],
      type: 'unique',
      name: 'players_steam_id_unique'
    });

    // Also add an index for faster lookups
    await queryInterface.addIndex('players', ['steam_id'], {
      name: 'players_steam_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the unique constraint
    await queryInterface.removeConstraint('players', 'players_steam_id_unique');
    
    // Remove the index
    await queryInterface.removeIndex('players', 'players_steam_id_idx');
  }
};

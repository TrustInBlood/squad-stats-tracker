'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update the database charset and collation for the players table
    await queryInterface.sequelize.query(`
      ALTER TABLE players 
      CONVERT TO CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci;
    `);

    // Specifically update the lastKnownName column to ensure it uses utf8mb4
    await queryInterface.sequelize.query(`
      ALTER TABLE players 
      MODIFY lastKnownName VARCHAR(50) 
      CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert to utf8 charset and utf8_general_ci collation
    await queryInterface.sequelize.query(`
      ALTER TABLE players 
      CONVERT TO CHARACTER SET utf8 
      COLLATE utf8_general_ci;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE players 
      MODIFY lastKnownName VARCHAR(50) 
      CHARACTER SET utf8 
      COLLATE utf8_general_ci;
    `);
  }
}; 
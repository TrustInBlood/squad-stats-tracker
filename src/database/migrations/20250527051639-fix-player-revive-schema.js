'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename columns to match the model
    await queryInterface.renameColumn('player_revives', 'revivedSteamID', 'victimSteamID');
    await queryInterface.renameColumn('player_revives', 'revivedEOSID', 'victimEOSID');
    await queryInterface.renameColumn('player_revives', 'revivedTeamID', 'victimTeamID');

    // Update the index names to match the new column names
    await queryInterface.removeIndex('player_revives', 'idx_revive_revived_time');
    await queryInterface.addIndex('player_revives', ['victimSteamID', 'timestamp'], {
      name: 'idx_revive_victim_time'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert the column names
    await queryInterface.renameColumn('player_revives', 'victimSteamID', 'revivedSteamID');
    await queryInterface.renameColumn('player_revives', 'victimEOSID', 'revivedEOSID');
    await queryInterface.renameColumn('player_revives', 'victimTeamID', 'revivedTeamID');

    // Revert the index names
    await queryInterface.removeIndex('player_revives', 'idx_revive_victim_time');
    await queryInterface.addIndex('player_revives', ['revivedSteamID', 'timestamp'], {
      name: 'idx_revive_revived_time'
    });
  }
}; 
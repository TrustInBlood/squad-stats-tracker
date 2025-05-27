'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add missing fields
    await queryInterface.addColumn('player_revives', 'woundTime', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the victim was originally wounded'
    });

    await queryInterface.addColumn('player_revives', 'downTime', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time in seconds the player was down before revive'
    });

    await queryInterface.addColumn('player_revives', 'crossTeamRevive', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this was a cross-team revive (unusual)'
    });

    // Add missing indexes
    await queryInterface.addIndex('player_revives', ['crossTeamRevive'], {
      name: 'idx_revive_cross_team'
    });

    await queryInterface.addIndex('player_revives', ['victimSteamID', 'woundTime'], {
      name: 'idx_revive_wound_lookup'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('player_revives', 'idx_revive_cross_team');
    await queryInterface.removeIndex('player_revives', 'idx_revive_wound_lookup');

    // Then remove the columns
    await queryInterface.removeColumn('player_revives', 'woundTime');
    await queryInterface.removeColumn('player_revives', 'downTime');
    await queryInterface.removeColumn('player_revives', 'crossTeamRevive');
  }
}; 
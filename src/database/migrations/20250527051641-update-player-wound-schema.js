'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add damageType column first
    await queryInterface.addColumn('player_wounds', 'damageType', {
      type: DataTypes.ENUM('player', 'environment', 'vehicle', 'unknown'),
      allowNull: false,
      defaultValue: 'unknown',
      comment: 'Type of damage (player, environment, vehicle, or unknown)'
    });

    // Then modify victim columns to allow nulls
    await queryInterface.changeColumn('player_wounds', 'victimSteamID', {
      type: DataTypes.STRING(17),
      allowNull: true,
      comment: 'Steam ID of the victim (null for environmental damage)'
    });

    await queryInterface.changeColumn('player_wounds', 'victimEOSID', {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'EOS ID of the victim (null for environmental damage)'
    });

    await queryInterface.changeColumn('player_wounds', 'victimTeamID', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Team ID of the victim (null for environmental damage)'
    });

    // Add an index for the new damageType column
    await queryInterface.addIndex('player_wounds', ['damageType'], {
      name: 'idx_wound_damage_type'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the damageType index first
    await queryInterface.removeIndex('player_wounds', 'idx_wound_damage_type');

    // Remove the damageType column
    await queryInterface.removeColumn('player_wounds', 'damageType');

    // Restore NOT NULL constraints on victim columns
    await queryInterface.changeColumn('player_wounds', 'victimSteamID', {
      type: DataTypes.STRING(17),
      allowNull: false,
      comment: 'Steam ID of the victim'
    });

    await queryInterface.changeColumn('player_wounds', 'victimEOSID', {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'EOS ID of the victim'
    });

    await queryInterface.changeColumn('player_wounds', 'victimTeamID', {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Team ID of the victim'
    });
  }
}; 
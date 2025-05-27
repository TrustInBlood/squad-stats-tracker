'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First add the new damageType column
    await queryInterface.addColumn('player_damage', 'damageType', {
      type: DataTypes.ENUM('player', 'environment', 'vehicle', 'unknown'),
      allowNull: false,
      defaultValue: 'unknown',
      comment: 'Type of damage (player, environment, vehicle, or unknown)'
    });

    // Then modify the victim columns to allow nulls
    await queryInterface.changeColumn('player_damage', 'victimSteamID', {
      type: DataTypes.STRING(17),
      allowNull: true,
      comment: 'Steam ID of the victim (null for environmental damage)'
    });

    await queryInterface.changeColumn('player_damage', 'victimEOSID', {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'EOS ID of the victim (null for environmental damage)'
    });

    await queryInterface.changeColumn('player_damage', 'victimTeamID', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Team ID of the victim (null for environmental damage)'
    });

    // Add an index for the new damageType column
    await queryInterface.addIndex('player_damage', ['damageType'], {
      name: 'idx_damage_type'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the damageType index
    await queryInterface.removeIndex('player_damage', 'idx_damage_type');

    // Remove the damageType column
    await queryInterface.removeColumn('player_damage', 'damageType');

    // Restore the original non-null constraints
    await queryInterface.changeColumn('player_damage', 'victimSteamID', {
      type: DataTypes.STRING(17),
      allowNull: false,
      comment: 'Steam ID of the victim'
    });

    await queryInterface.changeColumn('player_damage', 'victimEOSID', {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'EOS ID of the victim'
    });

    await queryInterface.changeColumn('player_damage', 'victimTeamID', {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Team ID of the victim'
    });
  }
}; 
'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('player_deaths', 'victimSteamID', {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Steam ID of the victim (null for environmental death)'
    });
    await queryInterface.changeColumn('player_deaths', 'victimEOSID', {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'EOS ID of the victim (null for environmental death)'
    });
    await queryInterface.changeColumn('player_deaths', 'victimTeamID', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Team ID of the victim (null for environmental death)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('player_deaths', 'victimSteamID', {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Steam ID of the victim'
    });
    await queryInterface.changeColumn('player_deaths', 'victimEOSID', {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'EOS ID of the victim'
    });
    await queryInterface.changeColumn('player_deaths', 'victimTeamID', {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Team ID of the victim'
    });
  }
}; 
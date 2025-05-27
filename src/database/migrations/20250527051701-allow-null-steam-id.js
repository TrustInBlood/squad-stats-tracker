'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('discord_steam_links', 'steamID', {
      type: DataTypes.STRING(17),
      allowNull: true,
      comment: 'Steam ID linked to this Discord account'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('discord_steam_links', 'steamID', {
      type: DataTypes.STRING(17),
      allowNull: false,
      comment: 'Steam ID linked to this Discord account'
    });
  }
}; 
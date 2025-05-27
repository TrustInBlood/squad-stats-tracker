'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the missing damage field
    await queryInterface.addColumn('player_deaths', 'damage', {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Killing damage amount (usually 300)'
    });

    // Add the woundTime field back
    await queryInterface.addColumn('player_deaths', 'woundTime', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the victim was initially wounded'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeColumn('player_deaths', 'damage');
    await queryInterface.removeColumn('player_deaths', 'woundTime');
  }
}; 
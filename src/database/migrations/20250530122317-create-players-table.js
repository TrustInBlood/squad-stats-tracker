'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('players', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      steam_id: {
        type: Sequelize.STRING(20),
        unique: true,
        allowNull: false,
      },
      eos_id: {
        type: Sequelize.STRING(34),
        unique: true,
        allowNull: false,
      },
      last_known_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      first_seen: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      last_seen: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    }, {
      indexes: [
        { fields: ['steam_id'] },
        { fields: ['eos_id'] },
        { fields: ['last_seen'] },
      ],
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('players');
  },
};
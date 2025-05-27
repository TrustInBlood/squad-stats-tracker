'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('servers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      serverID: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Server identifier from Squad.js (e.g., "server4")'
      },
      serverName: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Friendly name for the server'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Description of the server purpose/type'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this server is currently active'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes
    await queryInterface.addIndex('servers', ['serverID'], {
      name: 'idx_server_id'
    });

    await queryInterface.addIndex('servers', ['isActive'], {
      name: 'idx_server_active'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('servers', 'idx_server_id');
    await queryInterface.removeIndex('servers', 'idx_server_active');

    // Then remove the table
    await queryInterface.dropTable('servers');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('command_cooldowns', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      discord_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      command_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_used: {
        type: Sequelize.DATE,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      }
    });

    // Add a unique constraint for discord_id and command_name combination
    await queryInterface.addIndex('command_cooldowns', ['discord_id', 'command_name'], {
      unique: true,
      name: 'command_cooldowns_discord_command_unique'
    });

    // Add index for faster lookups
    await queryInterface.addIndex('command_cooldowns', ['discord_id', 'command_name', 'last_used'], {
      name: 'command_cooldowns_lookup_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('command_cooldowns');
  }
};

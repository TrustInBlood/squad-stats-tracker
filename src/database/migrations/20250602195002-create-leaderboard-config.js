'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leaderboard_config', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      channel_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Discord channel ID where the leaderboard message is posted'
      },
      message_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Discord message ID of the leaderboard message. Null if message was deleted'
      },
      leaderboard_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '24h',
        comment: 'Type of leaderboard (e.g., "24h", "7d")'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['channel_id', 'leaderboard_type'],
          name: 'leaderboard_config_channel_type_unique'
        }
      ]
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('leaderboard_config');
  }
};

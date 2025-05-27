'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('discord_steam_links', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      discordID: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Discord user ID'
      },
      steamID: {
        type: Sequelize.STRING(17),
        allowNull: false,
        comment: 'Steam ID linked to this Discord account'
      },
      verificationCode: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'Code user must type in-game to verify ownership'
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether the link has been verified'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this is the currently displayed link (only one active per Discord user)'
      },
      isHidden: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this link is hidden from user view (admin tracking only)'
      },
      linkedBy: {
        type: Sequelize.ENUM('user', 'admin', 'auto_detected'),
        defaultValue: 'user',
        comment: 'How this link was created'
      },
      confidence: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'verified'),
        defaultValue: 'low',
        comment: 'Confidence level of this link'
      },
      verifiedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the link was verified'
      },
      verificationExpires: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the verification code expires'
      },
      verificationServer: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Server where verification occurred'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes about this link'
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
    await queryInterface.addIndex('discord_steam_links', ['discordID'], {
      name: 'idx_discord_id'
    });

    await queryInterface.addIndex('discord_steam_links', ['steamID'], {
      name: 'idx_steam_id'
    });

    await queryInterface.addIndex('discord_steam_links', ['discordID', 'isActive'], {
      name: 'idx_discord_active'
    });

    await queryInterface.addIndex('discord_steam_links', ['verificationCode'], {
      name: 'idx_verification_code'
    });

    await queryInterface.addIndex('discord_steam_links', ['isVerified'], {
      name: 'idx_verified_status'
    });

    await queryInterface.addIndex('discord_steam_links', ['isHidden'], {
      name: 'idx_hidden_links'
    });

    await queryInterface.addIndex('discord_steam_links', ['verificationExpires'], {
      name: 'idx_verification_expires'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('discord_steam_links', 'idx_discord_id');
    await queryInterface.removeIndex('discord_steam_links', 'idx_steam_id');
    await queryInterface.removeIndex('discord_steam_links', 'idx_discord_active');
    await queryInterface.removeIndex('discord_steam_links', 'idx_verification_code');
    await queryInterface.removeIndex('discord_steam_links', 'idx_verified_status');
    await queryInterface.removeIndex('discord_steam_links', 'idx_hidden_links');
    await queryInterface.removeIndex('discord_steam_links', 'idx_verification_expires');

    // Then remove the table
    await queryInterface.dropTable('discord_steam_links');
  }
}; 
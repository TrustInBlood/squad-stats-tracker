'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('discord_steam_links', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      discordID: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Discord user ID'
      },
      steamID: {
        type: DataTypes.STRING(17),
        allowNull: false,
        comment: 'Steam ID linked to this Discord account'
      },
      verificationCode: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: 'Code user must type in-game to verify ownership'
      },
      isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether the link has been verified'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this is the currently displayed link (only one active per Discord user)'
      },
      isHidden: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this link is hidden from user view (admin tracking only)'
      },
      linkedBy: {
        type: DataTypes.ENUM('user', 'admin', 'auto_detected'),
        defaultValue: 'user',
        comment: 'How this link was created'
      },
      confidence: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'verified'),
        defaultValue: 'low',
        comment: 'Confidence level of this link'
      },
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the link was verified'
      },
      verificationExpires: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the verification code expires'
      },
      verificationServer: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Server where verification occurred'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Admin notes about this link'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
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
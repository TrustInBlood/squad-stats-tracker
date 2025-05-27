// database/discord-steam-link.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DiscordSteamLink = sequelize.define('DiscordSteamLink', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    discordID: {
      type: DataTypes.STRING(20),
      allowNull: false,
      index: true,
      comment: 'Discord user ID'
    },
    steamID: {
      type: DataTypes.STRING(17),
      allowNull: false,
      index: true,
      comment: 'Steam ID linked to this Discord account'
    },
    verificationCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      index: true,
      comment: 'Code user must type in-game to verify ownership'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true,
      comment: 'Whether the link has been verified'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      index: true,
      comment: 'Whether this is the currently displayed link (only one active per Discord user)'
    },
    isHidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true,
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
    }
  }, {
    timestamps: true, // createdAt and updatedAt
    tableName: 'discord_steam_links',
    indexes: [
      {
        name: 'idx_discord_id',
        fields: ['discordID']
      },
      {
        name: 'idx_steam_id',
        fields: ['steamID']
      },
      {
        name: 'idx_discord_active',
        fields: ['discordID', 'isActive']
      },
      {
        name: 'idx_verification_code',
        fields: ['verificationCode']
      },
      {
        name: 'idx_verified_status',
        fields: ['isVerified']
      },
      {
        name: 'idx_hidden_links',
        fields: ['isHidden']
      },
      {
        name: 'idx_verification_expires',
        fields: ['verificationExpires']
      }
    ]
  });

  // Generate a random verification code
  DiscordSteamLink.generateVerificationCode = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Create a new link request
  DiscordSteamLink.createLinkRequest = async function(discordID, steamID) {
    try {
      const verificationCode = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes

      // Check if this exact link already exists
      const existingLink = await this.findOne({
        where: { discordID, steamID }
      });

      if (existingLink) {
        // Update existing link with new verification code
        await existingLink.update({
          verificationCode,
          verificationExpires: expiresAt,
          isVerified: false
        });
        
        return { link: existingLink, isNew: false, error: null };
      }

      // Create new link request
      const link = await this.create({
        discordID,
        steamID,
        verificationCode,
        verificationExpires: expiresAt,
        isVerified: false,
        isActive: false, // Will be activated after verification
        isHidden: false,
        linkedBy: 'user',
        confidence: 'low'
      });

      return { link, isNew: true, error: null };
    } catch (error) {
      console.error('Error creating link request:', error);
      return { link: null, isNew: false, error: error.message };
    }
  };

  // Verify a link using the code
  DiscordSteamLink.verifyLink = async function(verificationCode, serverID = null) {
    try {
      const link = await this.findOne({
        where: {
          verificationCode,
          isVerified: false,
          verificationExpires: {
            [sequelize.Sequelize.Op.gt]: new Date()
          }
        }
      });

      if (!link) {
        return { success: false, link: null, error: 'Invalid or expired verification code' };
      }

      // Set all previous links for this Discord user to inactive (but keep them for tracking)
      await this.update(
        { isActive: false },
        { where: { discordID: link.discordID } }
      );

      // Activate and verify this link (becomes the new "active" one user sees)
      await link.update({
        isVerified: true,
        isActive: true,
        verifiedAt: new Date(),
        verificationServer: serverID,
        confidence: 'verified',
        verificationCode: null, // Clear the code
        verificationExpires: null
      });

      return { success: true, link, error: null };
    } catch (error) {
      console.error('Error verifying link:', error);
      return { success: false, link: null, error: error.message };
    }
  };

  // Get the active link for a Discord user (what they see - most recent verified link)
  DiscordSteamLink.getActiveLink = function(discordID) {
    return this.findOne({
      where: {
        discordID,
        isVerified: true,
        isHidden: false
      },
      order: [['verifiedAt', 'DESC']], // Most recent verified link
      limit: 1
    });
  };

  // Get ALL links for a Discord user (admin view - includes hidden alts)
  DiscordSteamLink.getAllLinks = function(discordID, includeHidden = false) {
    const where = { discordID };
    
    if (!includeHidden) {
      where.isHidden = false;
    }

    return this.findAll({
      where,
      order: [['verifiedAt', 'DESC']]
    });
  };

  // Get all Discord accounts linked to a Steam ID (for alt detection)
  DiscordSteamLink.getLinkedDiscordAccounts = function(steamID) {
    return this.findAll({
      where: {
        steamID,
        isVerified: true
      },
      order: [['verifiedAt', 'DESC']]
    });
  };

  // Admin function: Link accounts without verification (for detected alts)
  DiscordSteamLink.createAdminLink = async function(discordID, steamID, confidence = 'medium', notes = null, isHidden = true) {
    try {
      const link = await this.create({
        discordID,
        steamID,
        isVerified: true,
        isActive: false, // Hidden links are never active
        isHidden,
        linkedBy: 'admin',
        confidence,
        verifiedAt: new Date(),
        notes
      });

      return { link, error: null };
    } catch (error) {
      console.error('Error creating admin link:', error);
      return { link: null, error: error.message };
    }
  };

  // Auto-detect potential alts (called when processing game events)
  DiscordSteamLink.autoDetectAlt = async function(discordID, steamID, confidence = 'low', notes = null) {
    try {
      // Check if this link already exists
      const existingLink = await this.findOne({
        where: { discordID, steamID }
      });

      if (existingLink) {
        return { link: existingLink, created: false, error: null };
      }

      const link = await this.create({
        discordID,
        steamID,
        isVerified: false,
        isActive: false,
        isHidden: true,
        linkedBy: 'auto_detected',
        confidence,
        notes: notes || 'Auto-detected potential alt account'
      });

      return { link, created: true, error: null };
    } catch (error) {
      console.error('Error auto-detecting alt:', error);
      return { link: null, created: false, error: error.message };
    }
  };

  // Remove the switch active link function since users can't manually switch
  // The "active" link is always their most recently verified one

  // Clean up expired verification codes
  DiscordSteamLink.cleanupExpiredCodes = async function() {
    try {
      const deletedCount = await this.destroy({
        where: {
          isVerified: false,
          verificationExpires: {
            [sequelize.Sequelize.Op.lt]: new Date()
          }
        }
      });

      return { deletedCount, error: null };
    } catch (error) {
      console.error('Error cleaning up expired codes:', error);
      return { deletedCount: 0, error: error.message };
    }
  };

  // Admin queries
  DiscordSteamLink.getPotentialAlts = function(minLinks = 2) {
    return sequelize.query(`
      SELECT steamID, COUNT(*) as linkCount, 
             GROUP_CONCAT(discordID) as discordAccounts
      FROM discord_steam_links 
      WHERE isVerified = true 
      GROUP BY steamID 
      HAVING COUNT(*) >= ?
      ORDER BY linkCount DESC
    `, {
      replacements: [minLinks],
      type: sequelize.QueryTypes.SELECT
    });
  };

  DiscordSteamLink.getMultiAccountUsers = function(minAccounts = 2) {
    return sequelize.query(`
      SELECT discordID, COUNT(*) as accountCount, 
             GROUP_CONCAT(steamID) as steamAccounts
      FROM discord_steam_links 
      WHERE isVerified = true 
      GROUP BY discordID 
      HAVING COUNT(*) >= ?
      ORDER BY accountCount DESC
    `, {
      replacements: [minAccounts],
      type: sequelize.QueryTypes.SELECT
    });
  };

  return DiscordSteamLink;
};
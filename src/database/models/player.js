// database/player.js
const { DataTypes } = require('sequelize');

// Helper function to sanitize player names
function sanitizePlayerName(name) {
    if (!name) return null;
    
    // Truncate to 50 characters (database limit)
    let sanitized = name.slice(0, 50);
    
    // Remove control characters and other problematic Unicode
    sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Replace zero-width characters
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Replace invalid surrogate pairs
    sanitized = sanitized.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]?/g, '');
    
    // If the name is empty after sanitization, return null
    return sanitized.trim() || null;
}

module.exports = (sequelize) => {
  const Player = sequelize.define('Player', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    steamID: {
      type: DataTypes.STRING(17),
      unique: true,
      allowNull: false,
      index: true,
      comment: 'Steam ID (e.g., 76561198846542116)'
    },
    eosID: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      index: true,
      comment: 'Epic Online Services ID (e.g., 000282ef021a48bea43ea1ebe9c0e0eb)'
    },
    lastKnownName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Last known player name in game',
      set(value) {
        // Sanitize the name before setting
        this.setDataValue('lastKnownName', sanitizePlayerName(value));
      }
    },
    firstSeen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When we first saw this player'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this player record is active'
    }
  }, {
    timestamps: true, // Adds createdAt and updatedAt
    tableName: 'players',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      {
        name: 'idx_player_steam_id',
        fields: ['steamID']
      },
      {
        name: 'idx_player_eos_id', 
        fields: ['eosID']
      },
      {
        name: 'idx_player_active',
        fields: ['isActive']
      }
    ]
  });

  // Instance methods
  Player.prototype.updateName = function(newName) {
    const sanitizedName = sanitizePlayerName(newName);
    if (this.lastKnownName !== sanitizedName) {
      return this.update({ lastKnownName: sanitizedName });
    }
    return Promise.resolve(this);
  };

  // Class methods
  Player.findBySteamID = function(steamID) {
    return this.findOne({ where: { steamID, isActive: true } });
  };

  Player.findByEOSID = function(eosID) {
    return this.findOne({ where: { eosID, isActive: true } });
  };

  Player.getOrCreatePlayer = async function(playerData) {
    if (!playerData || !playerData.steamID || !playerData.eosID) {
      return { player: null, created: false, error: 'Player data must include steamID and eosID' };
    }

    try {
      const sanitizedName = sanitizePlayerName(playerData.name);
      const [player, created] = await this.findOrCreate({
        where: { steamID: playerData.steamID },
        defaults: {
          steamID: playerData.steamID,
          eosID: playerData.eosID,
          lastKnownName: sanitizedName,
          firstSeen: new Date(),
          isActive: true
        }
      });

      // Update name if this is an existing player and name changed
      if (!created && sanitizedName && player.lastKnownName !== sanitizedName) {
        await player.update({ lastKnownName: sanitizedName });
      }

      return { player, created, error: null };
    } catch (error) {
      console.error('Error creating/finding player:', error);
      return { player: null, created: false, error: error.message };
    }
  };

  return Player;
};
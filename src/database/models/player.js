// src/database/models/players.js
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Player extends Model {
    static associate(models) {
      // Define associations here
      Player.hasMany(models.Kill, { as: 'kills', foreignKey: 'attacker_id' });
      Player.hasMany(models.Kill, { as: 'deaths', foreignKey: 'victim_id' });
      Player.hasMany(models.Revive, { as: 'revivesGiven', foreignKey: 'reviver_id' });
      Player.hasMany(models.Revive, { as: 'revivesReceived', foreignKey: 'victim_id' });
      Player.hasMany(models.PlayerWounded, { as: 'woundsGiven', foreignKey: 'attacker_id' });
      Player.hasMany(models.PlayerWounded, { as: 'woundsReceived', foreignKey: 'victim_id' });
    }

    // Static method to safely upsert a player
    static async upsertPlayer(steamId, eosId, lastKnownName, transaction = null) {
      const now = new Date();

      // Need at least one ID to look up/create a player
      if (!steamId && !eosId) {
        throw new Error('Cannot upsert player without steamId or eosId');
      }

      // Build where clause based on available IDs - prefer steamId, fall back to eosId
      const whereClause = steamId
        ? { steam_id: steamId }
        : { eos_id: eosId };

      // First try to find existing player
      let player = await this.findOne({
        where: whereClause,
        transaction
      });

      if (player) {
        // Update existing player - only update IDs if we have new values
        const updateData = {
          last_seen: now,
          last_known_name: lastKnownName
        };
        if (eosId && player.eos_id !== eosId) {
          updateData.eos_id = eosId;
        }
        if (steamId && player.steam_id !== steamId) {
          updateData.steam_id = steamId;
        }
        await player.update(updateData, { transaction });
      } else {
        // Cannot create a player without both IDs (database constraint)
        if (!steamId || !eosId) {
          // Try to find by the other ID in case we have partial data
          if (steamId && !eosId) {
            // We have steamId but no eosId - can't create, skip
            return null;
          }
          if (eosId && !steamId) {
            // We have eosId but no steamId - can't create, skip
            return null;
          }
        }

        // Create new player - handle race condition where another transaction
        // may have created the player between our findOne and create
        try {
          player = await this.create({
            steam_id: steamId,
            eos_id: eosId,
            last_known_name: lastKnownName,
            first_seen: now,
            last_seen: now
          }, { transaction });
        } catch (error) {
          // If we get a unique constraint error, the player was created by another transaction
          // Retry the lookup and update instead
          if (error.name === 'SequelizeUniqueConstraintError') {
            player = await this.findOne({
              where: whereClause,
              transaction
            });
            if (player) {
              const updateData = {
                last_seen: now,
                last_known_name: lastKnownName
              };
              if (eosId) updateData.eos_id = eosId;
              if (steamId) updateData.steam_id = steamId;
              await player.update(updateData, { transaction });
            } else {
              // This shouldn't happen, but re-throw if it does
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      // Verify the player was created/updated
      if (!player || !player.id) {
        throw new Error(`Failed to create/update player: ${steamId || eosId}`);
      }

      return player;
    }
  }

  Player.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    steam_id: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
      validate: {
        len: [1, 20],
      },
    },
    eos_id: {
      type: DataTypes.STRING(34),
      unique: true,
      allowNull: false,
      validate: {
        len: [1, 34],
      },
    },
    last_known_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        // Allow most characters, but ensure it's not empty
        notEmpty: true,
      },
    },
    first_seen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    last_seen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    modelName: 'Player',
    tableName: 'players',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['steam_id'],
        name: 'players_steam_id_unique'
      },
      {
        unique: true,
        fields: ['eos_id'],
        name: 'players_eos_id_unique'
      }
    ]
  });

  return Player;
};
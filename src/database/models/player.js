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
      
      // First try to find existing player
      let player = await this.findOne({
        where: { steam_id: steamId },
        transaction
      });

      if (player) {
        // Update existing player
        await player.update({
          last_seen: now,
          last_known_name: lastKnownName,
          eos_id: eosId // Update EOS ID in case it changed
        }, { transaction });
      } else {
        // Create new player
        player = await this.create({
          steam_id: steamId,
          eos_id: eosId,
          last_known_name: lastKnownName,
          first_seen: now,
          last_seen: now
        }, { transaction });
      }

      // Verify the player was created/updated
      if (!player || !player.id) {
        throw new Error(`Failed to create/update player: ${steamId}`);
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
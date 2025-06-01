// src/database/models/players.js
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Player extends Model {
    static associate(models) {}
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
  });

  return Player;
};
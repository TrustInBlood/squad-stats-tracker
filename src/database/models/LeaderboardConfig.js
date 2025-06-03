'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class LeaderboardConfig extends Model {
    static associate(models) {
      // No associations needed for this model
    }
  }

  LeaderboardConfig.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord channel ID where the leaderboard message is posted'
    },
    message_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Discord message ID of the leaderboard message. Null if message was deleted'
    },
    leaderboard_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '24h',
      comment: 'Type of leaderboard (e.g., "24h", "7d")'
    }
  }, {
    sequelize,
    modelName: 'LeaderboardConfig',
    tableName: 'leaderboard_config',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return LeaderboardConfig;
}; 
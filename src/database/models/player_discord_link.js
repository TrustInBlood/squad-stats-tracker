const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlayerDiscordLink = sequelize.define('PlayerDiscordLink', {
    player_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    discord_id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    linked_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'player_discord_links',
    timestamps: false
  });
  return PlayerDiscordLink;
};
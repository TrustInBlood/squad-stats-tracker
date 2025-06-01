const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UnlinkHistory = sequelize.define('UnlinkHistory', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    player_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    discord_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    unlinked_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'unlink_history',
    timestamps: false
  });
  return UnlinkHistory;
};
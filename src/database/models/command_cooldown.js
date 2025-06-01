const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommandCooldown = sequelize.define('CommandCooldown', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    discord_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    command_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    last_used: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'command_cooldowns',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  CommandCooldown.associate = (models) => {
    // No associations needed for this table
  };

  return CommandCooldown;
}; 
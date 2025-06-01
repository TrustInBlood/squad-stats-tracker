const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Kill = sequelize.define('Kill', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    server_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    attacker_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'players', key: 'id' }
    },
    victim_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'players', key: 'id' }
    },
    weapon_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'weapons', key: 'id' }
    },
    teamkill: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'kills',
    underscored: true // Align with player_wounded
  });

  Kill.associate = (models) => {
    Kill.belongsTo(models.Player, { as: 'attacker', foreignKey: 'attacker_id' });
    Kill.belongsTo(models.Player, { as: 'victim', foreignKey: 'victim_id' });
    Kill.belongsTo(models.Weapon, { foreignKey: 'weapon_id' });
  };

  return Kill;
};
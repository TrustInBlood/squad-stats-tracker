const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Revive = sequelize.define('Revive', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    server_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reviver_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'players', key: 'id' }
    },
    victim_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'players', key: 'id' }
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'revives',
    underscored: true // Matches player_wounded and kills
  });

  Revive.associate = (models) => {
    Revive.belongsTo(models.Player, { as: 'reviver', foreignKey: 'reviver_id' });
    Revive.belongsTo(models.Player, { as: 'victim', foreignKey: 'victim_id' });
  };

  return Revive;
};
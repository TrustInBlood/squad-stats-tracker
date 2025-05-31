const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlayerWounded = sequelize.define('PlayerWounded', {
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
      type: DataTypes.INTEGER, // Match players.id
      allowNull: true,
      references: { model: 'players', key: 'id' }
    },
    victim_id: {
      type: DataTypes.INTEGER, // Match players.id
      allowNull: true,
      references: { model: 'players', key: 'id' }
    },
    weapon_id: {
      type: DataTypes.BIGINT, // Match weapons.id
      allowNull: true,
      references: { model: 'weapons', key: 'id' }
    },
    damage: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    teamkill: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    attacker_squad_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    victim_squad_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    attacker_team_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    victim_team_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'player_wounded',
    underscored: true
  });
  return PlayerWounded;
};
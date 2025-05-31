const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Weapon = sequelize.define('Weapon', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    tableName: 'weapons',
    underscored: true
  });
  return Weapon;
};
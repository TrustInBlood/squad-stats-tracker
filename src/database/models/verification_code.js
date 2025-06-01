const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VerificationCode = sequelize.define('VerificationCode', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    discord_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    interaction_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    application_id: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'verification_codes',
    timestamps: false
  });
  return VerificationCode;
};
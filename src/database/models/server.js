// database/server.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Server = sequelize.define('Server', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    serverID: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
      index: true,
      comment: 'Server identifier from Squad.js (e.g., "server4")'
    },
    serverName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Friendly name for the server'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of the server purpose/type'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      index: true,
      comment: 'Whether this server is currently active'
    }
  }, {
    timestamps: true, // Adds createdAt and updatedAt
    tableName: 'servers',
    indexes: [
      {
        name: 'idx_server_id',
        fields: ['serverID']
      },
      {
        name: 'idx_server_active',
        fields: ['isActive']
      }
    ]
  });

  // Class methods
  Server.findByServerID = function(serverID) {
    return this.findOne({ where: { serverID, isActive: true } });
  };

  Server.getOrCreateServer = async function(serverID, serverName = null) {
    if (!serverID) {
      return { server: null, created: false, error: 'Server ID is required' };
    }

    try {
      const [server, created] = await this.findOrCreate({
        where: { serverID },
        defaults: {
          serverID,
          serverName: serverName || `Server ${serverID}`,
          isActive: true
        }
      });

      return { server, created, error: null };
    } catch (error) {
      console.error('Error creating/finding server:', error);
      return { server: null, created: false, error: error.message };
    }
  };

  Server.getAllActiveServers = function() {
    return this.findAll({ 
      where: { isActive: true },
      order: [['serverID', 'ASC']]
    });
  };

  // Instance methods
  Server.prototype.deactivate = function() {
    return this.update({ isActive: false });
  };

  Server.prototype.activate = function() {
    return this.update({ isActive: true });
  };

  Server.prototype.updateName = function(newName) {
    return this.update({ serverName: newName });
  };

  return Server;
};
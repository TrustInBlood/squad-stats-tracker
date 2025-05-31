module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('player_wounded', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      server_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attacker_id: {
        type: Sequelize.INTEGER, // Match players.id (int(11))
        allowNull: true,
        references: { model: 'players', key: 'id' }
      },
      victim_id: {
        type: Sequelize.INTEGER, // Match players.id (int(11))
        allowNull: true,
        references: { model: 'players', key: 'id' }
      },
      weapon_id: {
        type: Sequelize.BIGINT, // Match weapons.id (bigint(20), signed)
        allowNull: true,
        references: { model: 'weapons', key: 'id' }
      },
      damage: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      teamkill: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      attacker_squad_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      victim_squad_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      attacker_team_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      victim_team_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('player_wounded');
  }
};
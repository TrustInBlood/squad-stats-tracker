module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('kills', {
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
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'players', key: 'id' }
      },
      victim_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'players', key: 'id' }
      },
      weapon_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'weapons', key: 'id' }
      },
      teamkill: {
        type: Sequelize.BOOLEAN,
        allowNull: false
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
    await queryInterface.dropTable('kills');
  }
};
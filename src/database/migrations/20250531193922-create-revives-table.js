module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('revives', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      server_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      reviver_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'players', key: 'id' }
      },
      victim_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'players', key: 'id' }
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
    await queryInterface.dropTable('revives');
  }
};
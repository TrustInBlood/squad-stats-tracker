module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('unlink_history', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      player_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'players', key: 'id' }
      },
      discord_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      unlinked_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('unlink_history');
  }
};
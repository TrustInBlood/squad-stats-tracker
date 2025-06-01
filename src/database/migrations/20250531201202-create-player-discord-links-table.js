module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('player_discord_links', {
      player_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'players', key: 'id' },
        primaryKey: true
      },
      discord_id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      linked_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('player_discord_links');
  }
};
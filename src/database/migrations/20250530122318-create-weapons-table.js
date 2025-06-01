module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('weapons', {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
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
      await queryInterface.dropTable('weapons');
    }
  };
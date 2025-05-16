# Database Migrations

This directory contains database migration files that help manage database schema changes over time using Sequelize.

## Migration File Naming Convention

Migrations are automatically named by Sequelize using the following format:
`YYYYMMDDHHMMSS-migration-name.js`

Example: `20240315120000-create-players-table.js`

## Running Migrations

To run migrations, you'll need to:

1. Install the required dependencies:
```bash
npm install sequelize mariadb sequelize-cli
```

2. Add these scripts to your package.json:
```json
{
  "scripts": {
    "migrate": "sequelize-cli db:migrate",
    "migrate:undo": "sequelize-cli db:migrate:undo",
    "migrate:undo:all": "sequelize-cli db:migrate:undo:all",
    "migrate:create": "sequelize-cli migration:create"
  }
}
```

3. Create a new migration:
```bash
npm run migrate:create -- --name descriptive_name
```

4. Run migrations:
```bash
npm run migrate
```

5. Undo the last migration:
```bash
npm run migrate:undo
```

6. Undo all migrations:
```bash
npm run migrate:undo:all
```

## Migration File Structure

Each migration file should export two functions:

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Migration code here
    // Example:
    // await queryInterface.createTable('players', {
    //   id: {
    //     allowNull: false,
    //     autoIncrement: true,
    //     primaryKey: true,
    //     type: Sequelize.INTEGER
    //   },
    //   name: {
    //     type: Sequelize.STRING,
    //     allowNull: false
    //   },
    //   createdAt: {
    //     allowNull: false,
    //     type: Sequelize.DATE,
    //     defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    //   },
    //   updatedAt: {
    //     allowNull: false,
    //     type: Sequelize.DATE,
    //     defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    //   }
    // });
  },

  down: async (queryInterface, Sequelize) => {
    // Rollback code here
    // Example:
    // await queryInterface.dropTable('players');
  }
};
```

## Sequelize Configuration

Create a `.sequelizerc` file in your project root to configure Sequelize CLI:

```javascript
const path = require('path');

module.exports = {
  'config': path.resolve('src/database', 'config.js'),
  'models-path': path.resolve('src/database', 'models'),
  'seeders-path': path.resolve('src/database', 'seeders'),
exports.up = pgm => {
  // Migration code here
  // Example:
  // pgm.createTable('players', {
  //   id: 'id',
  //   name: { type: 'varchar(255)', notNull: true },
  //   created_at: {
  //     type: 'timestamp',
  //     notNull: true,
  //     default: pgm.func('current_timestamp'),
  //   },
  // });
};

exports.down = pgm => {
  // Rollback code here
  // Example:
  // pgm.dropTable('players');
};
``` 
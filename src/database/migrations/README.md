# Database Migrations

This directory contains all database migrations for the Squad Stats Tracker bot.

## Running Migrations

There are two ways to run migrations:

1. **Automatic Migration (Recommended)**
   - Migrations run automatically when the bot starts
   - This is handled by `src/database/init.js`
   - No manual action required

2. **Manual Migration**
   - If you need to run migrations without starting the bot:
   ```bash
   npm run db:migrate
   ```
   - This uses the same migration system as the bot but runs independently
   - Useful for testing migrations or running them in CI/CD

## Migration Files

Migration files are named with a timestamp prefix to ensure proper ordering:
```
YYYYMMDDHHMMSS-description.js
```

## Creating New Migrations

To create a new migration:
```bash
npm run migrate:create -- --name description-of-changes
```

## Rolling Back Migrations

To undo the last migration:
```bash
npm run migrate:undo
```

To undo all migrations:
```bash
npm run migrate:undo:all
```

## Migration Format

Each migration file should export an object with `up` and `down` methods:

```javascript
'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Migration code here
  },

  async down(queryInterface, Sequelize) {
    // Rollback code here
  }
};
```

## Best Practices

1. Always include both `up` and `down` methods
2. Use `DataTypes` from sequelize for column types
3. Include comments for all columns
4. Test both migration and rollback
5. Keep migrations focused and atomic
6. Use descriptive names for migrations
7. Include indexes where appropriate
8. Handle both the migration and its rollback safely

## Common Operations

### Adding a Column
```javascript
await queryInterface.addColumn('table_name', 'column_name', {
  type: DataTypes.STRING(50),
  allowNull: false,
  comment: 'Description of the column'
});
```

### Modifying a Column
```javascript
await queryInterface.changeColumn('table_name', 'column_name', {
  type: DataTypes.STRING(100),
  allowNull: true,
  comment: 'Updated description'
});
```

### Adding an Index
```javascript
await queryInterface.addIndex('table_name', ['column_name'], {
  name: 'idx_table_column'
});
```

### Removing a Column
```javascript
await queryInterface.removeColumn('table_name', 'column_name');
```

## Troubleshooting

If you encounter issues with migrations:

1. Check the migration file format matches the template
2. Ensure all required fields are present
3. Verify the rollback method works
4. Check for any data dependencies
5. Look for circular references
6. Verify database connection settings

For more help, see the [Sequelize Migration Documentation](https://sequelize.org/docs/v6/other-topics/migrations/). 
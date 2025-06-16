# Database Module Documentation

This module provides a complete database connection and migration system for the Fishbowl PWA game application using SQLite.

## Features

- ✅ **SQLite Database Connection Management** - Connection pooling and health checks
- ✅ **Migration System** - Automatic schema versioning and migration runner
- ✅ **Database Utilities** - CRUD operations and query builders
- ✅ **Environment Support** - Development, production, and test configurations
- ✅ **Transaction Support** - Automatic transaction management
- ✅ **TypeScript Integration** - Full type safety throughout
- ✅ **Logging and Monitoring** - Query logging and performance tracking

## Quick Start

### Database Initialization

```typescript
import { initializeForEnvironment } from './db';

// Initialize database based on NODE_ENV
const result = await initializeForEnvironment();
if (result.success) {
  console.log('Database ready!');
}
```

### Basic Operations

```typescript
import { getConnection, insert, findById, update } from './db';

// Insert a new game
const gameId = await insert('games', {
  id: 'game-123',
  name: 'My Game',
  status: 'waiting',
  host_player_id: 'player-1',
  team_count: 2,
  phrases_per_player: 5,
  timer_duration: 60,
  current_round: 1,
  current_team: 1
});

// Find a game by ID
const game = await findById('games', 'game-123');

// Update a game
await update('games', 
  { status: 'playing' },
  [{ field: 'id', operator: '=', value: 'game-123' }]
);
```

### Using Transactions

```typescript
import { withTransaction } from './db';

await withTransaction(async (transaction) => {
  // All operations within this block are in a transaction
  await insert('games', gameData, transaction);
  await insert('players', playerData, transaction);
  // Transaction is automatically committed if no errors
  // Transaction is automatically rolled back if any error occurs
});
```

## Core Components

### 1. Connection Management (`connection.ts`)

Handles SQLite database connections with:
- Promisified database operations
- Connection health checks
- Automatic cleanup
- Transaction support

```typescript
import { getConnection, withConnection } from './db';

// Get a connection for multiple operations
const connection = await getConnection();
try {
  const result = await connection.get('SELECT * FROM games WHERE id = ?', [gameId]);
  return result;
} finally {
  await connection.close();
}

// Or use connection wrapper (recommended)
const result = await withConnection(async (connection) => {
  return await connection.get('SELECT * FROM games WHERE id = ?', [gameId]);
});
```

### 2. Migration System (`migrator.ts`)

Automatic database schema versioning:
- Sequential migration execution
- Rollback support
- Migration validation
- Status tracking

```typescript
import { runMigrations, getMigrationStatus, migrateTo } from './db';

// Run all pending migrations
await runMigrations();

// Check migration status
const status = await getMigrationStatus();
console.log(`Current version: ${status.currentVersion}`);

// Migrate to specific version
await migrateTo(2);
```

### 3. Database Utilities (`utils.ts`)

High-level database operations:
- CRUD operations
- Query builders
- Batch operations
- Maintenance functions

```typescript
import { select, count, exists, batchInsert } from './db';

// Complex queries with conditions
const games = await select('games', {
  where: [
    { field: 'status', operator: '=', value: 'playing' },
    { field: 'team_count', operator: '>', value: 2 }
  ],
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
  limit: 10
});

// Count records
const activeGames = await count('games', [
  { field: 'status', operator: '=', value: 'playing' }
]);

// Check existence
const gameExists = await exists('games', [
  { field: 'id', operator: '=', value: 'game-123' }
]);

// Batch operations
await batchInsert('phrases', phraseArray);
```

### 4. Environment Initialization (`init.ts`)

Environment-specific database setup:
- Development with sample data
- Production with optimizations
- Test with in-memory database

```typescript
import { 
  initializeDevelopmentDatabase,
  initializeProductionDatabase,
  initializeTestDatabase,
  getDatabaseStatus 
} from './db';

// Environment-specific initialization
const result = await initializeDevelopmentDatabase();

// Get comprehensive status
const status = await getDatabaseStatus();
console.log(status);
```

## Database Schema

The application uses a relational schema with the following main entities:

- **Games** - Game sessions with configuration
- **Players** - Users participating in games
- **Teams** - Team assignments and scoring
- **Phrases** - User-submitted phrases for guessing
- **Turns** - Individual turn tracking with timing
- **Turn Phrases** - Actions taken on phrases during turns

See [`schema.ts`](./schema.ts) for complete schema definitions.

## Migration System

### Creating New Migrations

1. Create a new migration file: `src/db/migrations/002_description.ts`
2. Export a Migration object with up/down functions
3. Add to the MIGRATIONS array in `migrations/index.ts`

```typescript
// migrations/002_add_game_settings.ts
export const migration_002: Migration = {
  version: 2,
  name: 'add_game_settings',
  
  up: async (db) => {
    await db.exec(`
      ALTER TABLE games 
      ADD COLUMN max_skips INTEGER DEFAULT 3
    `);
  },
  
  down: async (db) => {
    // SQLite doesn't support DROP COLUMN, so we'd need to recreate table
    // This is why careful planning of initial schema is important
  }
};
```

### Migration Commands

```bash
npm run migrate
```

## Environment Configuration

### Development
- Database file: `./database/fishbowl.db`
- Sample data created automatically
- Query logging enabled

### Production
- Database file: configurable via `DB_PATH` environment variable
- No sample data
- Optimized settings

### Test
- In-memory database (`:memory:`)
- Clean slate for each test run
- Fast initialization

## Environment Variables

```bash
# Database file path (default: ./database/fishbowl.db)
DB_PATH=/path/to/database.db

# Database timeout in milliseconds (default: 5000)
DB_TIMEOUT=10000

# Maximum connections (default: 10)
DB_MAX_CONNECTIONS=20

# Create sample data in development
CREATE_SAMPLE_DATA=true
```

## Health Monitoring

### Health Check Endpoint

The server provides database health information at `/api/health`:

```json
{
  "status": "ok",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "uptime": 3600,
  "database": {
    "healthy": true,
    "environment": "development"
  }
}
```

### Detailed Status Endpoint

Get comprehensive database status at `/api/database/status`:

```json
{
  "healthy": true,
  "migration": {
    "currentVersion": 1,
    "latestVersion": 1,
    "isUpToDate": true
  },
  "stats": {
    "sqliteVersion": "3.45.0",
    "tableCount": 7,
    "fileSize": 98304
  },
  "integrity": {
    "valid": true,
    "issues": []
  }
}
```

## Testing

The module includes comprehensive tests covering:
- Connection management
- Migration execution
- CRUD operations
- Transaction handling
- Error scenarios

```bash
# Run database tests
npm test -- database.test.ts

# Run database verification
npx ts-node src/db/verify.ts
```

## Performance Considerations

1. **Connection Management**: Connections are automatically managed and cleaned up
2. **Indexing**: All necessary indexes are created during migration
3. **Query Optimization**: Use the provided query builders for optimal performance
4. **Batch Operations**: Use `batchInsert` for multiple record operations
5. **Transactions**: Group related operations in transactions for consistency

## Troubleshooting

### Common Issues

1. **Migration Failures**: Check migration order and dependencies
2. **Connection Timeouts**: Increase `DB_TIMEOUT` for slow operations
3. **File Permissions**: Ensure write access to database directory
4. **Foreign Key Constraints**: Enable with `PRAGMA foreign_keys = ON`

### Debugging

Enable query logging in development:

```typescript
import { QueryLogger } from './db';

// View recent queries
console.log(QueryLogger.getLogs());

// View slow queries
console.log(QueryLogger.getSlowQueries(100)); // > 100ms
```

## Integration with Express Server

The database is automatically initialized when the server starts:

```typescript
// server.ts
import { initializeForEnvironment } from './db';

async function startServer() {
  const dbResult = await initializeForEnvironment();
  if (!dbResult.success) {
    console.error('Database initialization failed');
    process.exit(1);
  }
  
  // Start HTTP server...
}
```

The server includes graceful shutdown with database cleanup:

```typescript
process.on('SIGTERM', async () => {
  await cleanup(); // Closes all database connections
  process.exit(0);
});
```
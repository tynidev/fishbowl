// Database functionality tests
// Tests for connection, migrations, and basic operations

import { initializeTestDatabase, getDatabaseStatus } from '../../src/db/init';
import {
  initializeDatabase,
  getConnection,
  withConnection,
  withTransaction,
  healthCheck
} from '../../src/db/connection';
import {
  runMigrations,
  getMigrationStatus,
  validateMigrations
} from '../../src/db/migrator';
import {
  insert,
  select,
  update,
  deleteRecords,
  findById,
  exists,
  count
} from '../../src/db/utils';

describe('Database Connection', () => {
  beforeEach(async () => {
    await initializeDatabase({ filename: ':memory:' });
  });

  test('should establish database connection', async () => {
    const connection = await getConnection();
    expect(connection).toBeDefined();
    expect(connection.db).toBeDefined();
    await connection.close();
  });

  test('should perform health check', async () => {
    const isHealthy = await healthCheck();
    expect(isHealthy).toBe(true);
  });

  test('should execute query with connection wrapper', async () => {
    const result = await withConnection(async (connection) => {
      return await connection.get('SELECT 1 as test');
    });
    expect(result).toEqual({ test: 1 });
  });

  test('should handle transactions', async () => {
    await withTransaction(async (transaction) => {
      await transaction.exec('CREATE TABLE test_table (id INTEGER, name TEXT)');
      await transaction.run('INSERT INTO test_table (id, name) VALUES (?, ?)', [1, 'test']);

      const result = await transaction.get('SELECT * FROM test_table WHERE id = ?', [1]);
      expect(result).toEqual({ id: 1, name: 'test' });
    });
  });
});

describe('Database Migrations', () => {
  beforeEach(async () => {
    await initializeDatabase({ filename: ':memory:' });
  });

  test('should validate migrations', async () => {
    const validation = await validateMigrations();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
  test('should run migrations', async () => {
    const results = await runMigrations();
    expect(results).toBeDefined();

    // Wait a bit to ensure transaction is committed
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = await getMigrationStatus();
    expect(status.isUpToDate).toBe(true);
    expect(status.currentVersion).toBeGreaterThan(0);
  });

  test('should get migration status', async () => {
    await runMigrations();
    const status = await getMigrationStatus();

    expect(status).toHaveProperty('currentVersion');
    expect(status).toHaveProperty('latestVersion');
    expect(status).toHaveProperty('isUpToDate');
    expect(status).toHaveProperty('appliedMigrations');
    expect(status).toHaveProperty('pendingMigrations');
  });
});

describe('Database Utils', () => {
  beforeEach(async () => {
    await initializeDatabase({ filename: ':memory:' });
    await runMigrations();
  });

  test('should insert and retrieve records', async () => {
    const gameData = {
      id: 'test-game-1',
      name: 'Test Game',
      status: 'setup', sub_status: 'waiting_for_players',
      host_player_id: 'test-player-1',
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 1,
      current_team: 1
    };

    await insert('games', gameData);
    const retrieved = await findById('games', 'test-game-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Game');
    expect(retrieved?.status).toBe('setup');
    expect(retrieved?.sub_status).toBe('waiting_for_players');
  });

  test('should update records', async () => {
    const gameData = {
      id: 'test-game-2',
      name: 'Test Game 2',
      status: 'setup', sub_status: 'waiting_for_players',
      host_player_id: 'test-player-1',
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 1,
      current_team: 1
    };

    await insert('games', gameData);

    const updated = await update('games',
      { status: 'playing', sub_status: 'turn_active', current_round: 2 },
      [{ field: 'id', operator: '=', value: 'test-game-2' }]
    );

    expect(updated).toBe(1);

    const retrieved = await findById('games', 'test-game-2');
    expect(retrieved?.status).toBe('playing');
    expect(retrieved?.sub_status).toBe('turn_active');
    expect(retrieved?.current_round).toBe(2);
  });

  test('should delete records', async () => {
    const gameData = {
      id: 'test-game-3',
      name: 'Test Game 3',
      status: 'setup', sub_status: 'waiting_for_players',
      host_player_id: 'test-player-1',
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 1,
      current_team: 1
    };

    await insert('games', gameData);

    const deleted = await deleteRecords('games',
      [{ field: 'id', operator: '=', value: 'test-game-3' }]
    );

    expect(deleted).toBe(1);

    const retrieved = await findById('games', 'test-game-3');
    expect(retrieved).toBeUndefined();
  });

  test('should check if records exist', async () => {
    const gameData = {
      id: 'test-game-4',
      name: 'Test Game 4',
      status: 'setup', sub_status: 'waiting_for_players',
      host_player_id: 'test-player-1',
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 1,
      current_team: 1
    };

    await insert('games', gameData);

    const doesExist = await exists('games',
      [{ field: 'id', operator: '=', value: 'test-game-4' }]
    );

    const doesNotExist = await exists('games',
      [{ field: 'id', operator: '=', value: 'nonexistent-game' }]
    );

    expect(doesExist).toBe(true);
    expect(doesNotExist).toBe(false);
  });

  test('should count records', async () => {
    const games = [
      {
        id: 'test-game-5',
        name: 'Test Game 5',
        status: 'setup', sub_status: 'waiting_for_players',
        host_player_id: 'test-player-1',
        team_count: 2,
        phrases_per_player: 5,
        timer_duration: 60,
        current_round: 1,
        current_team: 1
      },
      {
        id: 'test-game-6',
        name: 'Test Game 6',
        status: 'playing', sub_status: 'turn_active',
        host_player_id: 'test-player-2',
        team_count: 2,
        phrases_per_player: 5,
        timer_duration: 60,
        current_round: 1,
        current_team: 1
      }
    ];

    for (const game of games) {
      await insert('games', game);
    }
    const totalCount = await count('games');
    const setupCount = await count('games',
      [{ field: 'status', operator: '=', value: 'setup' }]
    );

    expect(totalCount).toBeGreaterThanOrEqual(2);
    expect(setupCount).toBeGreaterThanOrEqual(1);
  });

  test('should handle complex where conditions', async () => {
    const games = [
      {
        id: 'test-game-7',
        name: 'Test Game 7',
        status: 'setup', sub_status: 'waiting_for_players',
        host_player_id: 'test-player-1',
        team_count: 2,
        phrases_per_player: 5,
        timer_duration: 60,
        current_round: 1,
        current_team: 1
      },
      {
        id: 'test-game-8',
        name: 'Test Game 8',
        status: 'playing', sub_status: 'turn_active',
        host_player_id: 'test-player-1',
        team_count: 4,
        phrases_per_player: 3,
        timer_duration: 90,
        current_round: 2,
        current_team: 2
      }
    ];

    for (const game of games) {
      await insert('games', game);
    }

    const results = await select('games', {
      where: [
        { field: 'host_player_id', operator: '=', value: 'test-player-1' },
        { field: 'team_count', operator: '>', value: 2 }
      ],
      orderBy: [{ field: 'name', direction: 'ASC' }],
      limit: 1
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Test Game 8');
  });
});

describe('Database Initialization', () => {
  test('should initialize test database', async () => {
    const result = await initializeTestDatabase();

    expect(result.success).toBe(true);
    expect(result.databasePath).toBe(':memory:');
    expect(result.migrationStatus).toBeDefined();
    expect(result.stats).toBeDefined();
  });

  test('should get database status', async () => {
    await initializeTestDatabase();
    const status = await getDatabaseStatus();

    expect(status).toHaveProperty('healthy');
    expect(status).toHaveProperty('migration');
    expect(status).toHaveProperty('stats');
    expect(status).toHaveProperty('integrity');
    expect(status.healthy).toBe(true);
  });
});
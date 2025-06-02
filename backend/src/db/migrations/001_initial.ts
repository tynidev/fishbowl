// Initial database migration for Fishbowl game application
// Migration: 001 - Create initial schema

import { ALL_TABLES, CREATE_INDEXES, CREATE_TRIGGERS } from '../schema';

export interface Migration {
  version: number;
  name: string;
  up: (db: any) => Promise<void>;
  down: (db: any) => Promise<void>;
}

export const migration_001: Migration = {
  version: 1,
  name: 'initial_schema',

  up: async (db: any): Promise<void> => {
    console.log('Running migration 001: Creating initial schema...');

    try {
      // Enable foreign key constraints
      await db.exec('PRAGMA foreign_keys = ON;');

      // Create all tables in the correct order (respecting foreign key dependencies)
      for (const tableSQL of ALL_TABLES) {
        await db.exec(tableSQL);
      }

      // Create indexes for performance
      for (const indexSQL of CREATE_INDEXES) {
        await db.exec(indexSQL);
      }
      // Create triggers for automatic timestamp updates
      for (const triggerSQL of CREATE_TRIGGERS) {
        await db.exec(triggerSQL);
      }

      console.log('Migration 001 completed successfully');
    } catch (error) {
      console.error('Migration 001 failed:', error);
      throw error;
    }
  },

  down: async (db: any): Promise<void> => {
    console.log('Rolling back migration 001...');

    try {
      // Drop tables in reverse order to respect foreign key constraints
      const dropStatements = [
        'DROP TABLE IF EXISTS turn_phrases;',
        'DROP TABLE IF EXISTS turns;',
        'DROP TABLE IF EXISTS phrases;',
        'DROP TABLE IF EXISTS teams;',
        'DROP TABLE IF EXISTS players;',
        'DROP TABLE IF EXISTS games;',
      ];

      for (const dropSQL of dropStatements) {
        await db.exec(dropSQL);
      }

      console.log('Migration 001 rollback completed');
    } catch (error) {
      console.error('Migration 001 rollback failed:', error);
      throw error;
    }
  },
};

// Export for migration runner
export default migration_001;

/**
 * Validate database schema integrity
 */
export async function validateSchema(db: any): Promise<boolean> {
  try {
    // Check if all required tables exist
    const requiredTables = [
      'games',
      'players',
      'teams',
      'phrases',
      'turns',
      'turn_phrases',
    ];

    for (const tableName of requiredTables) {
      const result = await db.get(
        `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `,
        [tableName]
      );

      if (!result) {
        console.error(`Required table '${tableName}' not found`);
        return false;
      }
    }

    // Check foreign key constraints are enabled
    const fkResult = await db.get('PRAGMA foreign_keys;');
    if (!fkResult || fkResult.foreign_keys !== 1) {
      console.warn('Foreign key constraints are not enabled');
    }

    console.log('Database schema validation passed');
    return true;
  } catch (error) {
    console.error('Schema validation failed:', error);
    return false;
  }
}

/**
 * Create sample data for testing (development only)
 */
export async function createSampleData(db: any): Promise<void> {
  console.log('Creating sample data...');

  try {
    // Sample game
    const gameId = 'game-001';
    const hostPlayerId = 'player-001';

    await db.run(
      `
      INSERT INTO games (id, name, status, host_player_id, team_count, phrases_per_player, timer_duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [gameId, 'Test Game', 'waiting', hostPlayerId, 2, 3, 60]
    );

    // Sample teams
    const team1Id = 'team-001';
    const team2Id = 'team-002';

    await db.run(
      `
      INSERT INTO teams (id, game_id, name, color)
      VALUES (?, ?, ?, ?)
    `,
      [team1Id, gameId, 'Team Red', '#FF6B6B']
    );

    await db.run(
      `
      INSERT INTO teams (id, game_id, name, color)
      VALUES (?, ?, ?, ?)
    `,
      [team2Id, gameId, 'Team Blue', '#4ECDC4']
    );

    // Sample players
    const players = [
      { id: 'player-001', name: 'Alice', teamId: team1Id },
      { id: 'player-002', name: 'Bob', teamId: team1Id },
      { id: 'player-003', name: 'Charlie', teamId: team2Id },
      { id: 'player-004', name: 'Diana', teamId: team2Id },
    ];

    for (const player of players) {
      await db.run(
        `
        INSERT INTO players (id, game_id, name, team_id)
        VALUES (?, ?, ?, ?)
      `,
        [player.id, gameId, player.name, player.teamId]
      );
    }

    // Sample phrases
    const phrases = [
      { playerId: 'player-001', text: 'Elephant' },
      { playerId: 'player-001', text: 'Pizza' },
      { playerId: 'player-001', text: 'Bicycle' },
      { playerId: 'player-002', text: 'Ocean' },
      { playerId: 'player-002', text: 'Guitar' },
      { playerId: 'player-002', text: 'Spaceship' },
      { playerId: 'player-003', text: 'Mountain' },
      { playerId: 'player-003', text: 'Cookie' },
      { playerId: 'player-003', text: 'Tornado' },
      { playerId: 'player-004', text: 'Library' },
      { playerId: 'player-004', text: 'Butterfly' },
      { playerId: 'player-004', text: 'Volcano' },
    ];

    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i]!; // Safe because i is within array bounds
      await db.run(
        `
        INSERT INTO phrases (id, game_id, player_id, text)
        VALUES (?, ?, ?, ?)
      `,
        [
          `phrase-${String(i + 1).padStart(3, '0')}`,
          gameId,
          phrase.playerId,
          phrase.text,
        ]
      );
    }

    console.log('Sample data created successfully');
  } catch (error) {
    console.error('Failed to create sample data:', error);
    throw error;
  }
}

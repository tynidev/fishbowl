// Update turns table migration for Fishbowl game application
// Migration: 003 - Update turns table to match schema.ts format

import type { Migration } from './001_initial';

export const migration_003: Migration = {
  version: 3,
  name: 'update_turns_table',
  up: async (db: any): Promise<void> => {
    console.log('Running migration 003: Updating turns table...');

    try {
      // Enable foreign key constraints
      await db.exec('PRAGMA foreign_keys = ON;');

      // Check if the table already has the correct schema by checking column names
      const tableInfo = await db.all('PRAGMA table_info(turns);');
      const columns = tableInfo.map((col: any) => col.name);
      
      // If the table already has 'player_id' and doesn't have 'acting_player_id', 
      // then it's already in the correct format (fresh migration from 001)
      const hasPlayerId = columns.includes('player_id');
      const hasActingPlayerId = columns.includes('acting_player_id');
      const hasNullableStartTime = tableInfo.find((col: any) => col.name === 'start_time')?.notnull === 0;
      
      if (hasPlayerId && !hasActingPlayerId && hasNullableStartTime) {
        console.log('Turns table already has correct schema, skipping migration 003');
        return;
      }

      if (!hasActingPlayerId) {
        console.log('Warning: Expected acting_player_id column not found, table might already be migrated');
        return;
      }

      // SQLite doesn't support ALTER COLUMN directly, so we need to:
      // 1. Create a new table with the correct schema
      // 2. Copy data from the old table
      // 3. Drop the old table
      // 4. Rename the new table
      // 5. Recreate indexes and triggers

      // Step 1: Create new turns table with updated schema
      await db.exec(`
        CREATE TABLE turns_new (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          round INTEGER NOT NULL CHECK (round >= 1 AND round <= 3),
          team_id TEXT NOT NULL,
          player_id TEXT NOT NULL,
          start_time TEXT,
          end_time TEXT,
          duration INTEGER NOT NULL DEFAULT 0,
          phrases_guessed INTEGER NOT NULL DEFAULT 0,
          phrases_skipped INTEGER NOT NULL DEFAULT 0,
          points_scored INTEGER NOT NULL DEFAULT 0,
          is_complete BOOLEAN NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
        );
      `);

      // Step 2: Copy data from old table to new table
      await db.exec(`
        INSERT INTO turns_new (
          id, game_id, round, team_id, player_id, start_time, end_time,
          duration, phrases_guessed, phrases_skipped, points_scored,
          is_complete, created_at, updated_at
        )
        SELECT 
          id, game_id, round, team_id, acting_player_id, start_time, end_time,
          duration, phrases_guessed, phrases_skipped, points_scored,
          is_complete, created_at, updated_at
        FROM turns;
      `);

      // Step 3: Drop old table
      await db.exec('DROP TABLE turns;');

      // Step 4: Rename new table
      await db.exec('ALTER TABLE turns_new RENAME TO turns;');

      // Step 5: Recreate indexes for turns table
      const turnsIndexes = [
        `CREATE INDEX IF NOT EXISTS idx_turns_game ON turns(game_id);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_team ON turns(team_id);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_player ON turns(player_id);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_game_round ON turns(game_id, round);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_complete ON turns(is_complete);`,
      ];

      for (const indexSQL of turnsIndexes) {
        await db.exec(indexSQL);
      }

      // Step 6: Recreate trigger for turns table
      await db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_turns_timestamp
        AFTER UPDATE ON turns
        BEGIN
          UPDATE turns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);

      // Step 7: Update any games table references that might point to turns
      // (The current_turn_id foreign key constraint should still work)

      console.log('Migration 003 completed successfully');
    } catch (error) {
      console.error('Migration 003 failed:', error);
      throw error;
    }
  },

  down: async (db: any): Promise<void> => {
    console.log('Rolling back migration 003...');

    try {
      // Enable foreign key constraints
      await db.exec('PRAGMA foreign_keys = ON;');

      // Reverse the changes: rename player_id back to acting_player_id and make start_time NOT NULL
      
      // Step 1: Create table with old schema
      await db.exec(`
        CREATE TABLE turns_old (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          round INTEGER NOT NULL CHECK (round >= 1 AND round <= 3),
          team_id TEXT NOT NULL,
          acting_player_id TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          duration INTEGER NOT NULL DEFAULT 0,
          phrases_guessed INTEGER NOT NULL DEFAULT 0,
          phrases_skipped INTEGER NOT NULL DEFAULT 0,
          points_scored INTEGER NOT NULL DEFAULT 0,
          is_complete BOOLEAN NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (acting_player_id) REFERENCES players(id) ON DELETE CASCADE
        );
      `);

      // Step 2: Copy data back (only rows with non-null start_time)
      await db.exec(`
        INSERT INTO turns_old (
          id, game_id, round, team_id, acting_player_id, start_time, end_time,
          duration, phrases_guessed, phrases_skipped, points_scored,
          is_complete, created_at, updated_at
        )
        SELECT 
          id, game_id, round, team_id, player_id, 
          COALESCE(start_time, CURRENT_TIMESTAMP), end_time,
          duration, phrases_guessed, phrases_skipped, points_scored,
          is_complete, created_at, updated_at
        FROM turns
        WHERE start_time IS NOT NULL OR start_time = '';
      `);

      // Step 3: Drop new table
      await db.exec('DROP TABLE turns;');

      // Step 4: Rename old table back
      await db.exec('ALTER TABLE turns_old RENAME TO turns;');

      // Step 5: Recreate indexes with old column name
      const turnsIndexes = [
        `CREATE INDEX IF NOT EXISTS idx_turns_game ON turns(game_id);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_team ON turns(team_id);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_player ON turns(acting_player_id);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_game_round ON turns(game_id, round);`,
        `CREATE INDEX IF NOT EXISTS idx_turns_complete ON turns(is_complete);`,
      ];

      for (const indexSQL of turnsIndexes) {
        await db.exec(indexSQL);
      }

      // Step 6: Recreate trigger
      await db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_turns_timestamp
        AFTER UPDATE ON turns
        BEGIN
          UPDATE turns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);

      console.log('Migration 003 rollback completed');
    } catch (error) {
      console.error('Migration 003 rollback failed:', error);
      throw error;
    }
  },
};

// Export for migration runner
export default migration_003;

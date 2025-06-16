import type { Migration } from './001_initial';

const migration_005: Migration = {
  version: 5,
  name: 'add_turn_order_table',

  up: async db =>
  {
    console.log('Running migration 005: Adding turn_order table...');

    try
    {
      // Create the turn_order table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS turn_order (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          player_id TEXT NOT NULL,
          team_id TEXT NOT NULL,
          next_player_id TEXT NOT NULL,
          prev_player_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (next_player_id) REFERENCES players(id) ON DELETE CASCADE,
          FOREIGN KEY (prev_player_id) REFERENCES players(id) ON DELETE CASCADE,
          UNIQUE(game_id, player_id)
        );
      `);

      // Create indexes for the turn_order table
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_turn_order_game ON turn_order(game_id);`,
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_turn_order_player ON turn_order(player_id);`,
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_turn_order_team ON turn_order(team_id);`,
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_turn_order_next_player ON turn_order(next_player_id);`,
      );
      await db.exec(
        `CREATE INDEX IF NOT EXISTS idx_turn_order_prev_player ON turn_order(prev_player_id);`,
      );

      // Create the updated_at trigger for turn_order
      await db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_turn_order_timestamp
        AFTER UPDATE ON turn_order
        BEGIN
          UPDATE turn_order SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);

      console.log('Migration 005 completed successfully');
    }
    catch (error)
    {
      console.error('Migration 005 failed:', error);
      throw error;
    }
  },

  down: async db =>
  {
    console.log('Rolling back migration 005: Removing turn_order table...');

    try
    {
      // Drop the trigger first
      await db.exec(`DROP TRIGGER IF EXISTS update_turn_order_timestamp;`);

      // Drop the indexes
      await db.exec(`DROP INDEX IF EXISTS idx_turn_order_game;`);
      await db.exec(`DROP INDEX IF EXISTS idx_turn_order_player;`);
      await db.exec(`DROP INDEX IF EXISTS idx_turn_order_team;`);
      await db.exec(`DROP INDEX IF EXISTS idx_turn_order_next_player;`);
      await db.exec(`DROP INDEX IF EXISTS idx_turn_order_prev_player;`);

      // Drop the table
      await db.exec(`DROP TABLE IF EXISTS turn_order;`);

      console.log('Migration 005 rollback completed');
    }
    catch (error)
    {
      console.error('Migration 005 rollback failed:', error);
      throw error;
    }
  },
};

export default migration_005;

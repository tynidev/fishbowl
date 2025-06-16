import type { Migration } from './001_initial';

const migration_004: Migration = {
  version: 4,
  name: 'Update game status schema with status and sub_status',
  up: async db => {
    // Backup existing data
    await db.exec(`
      CREATE TABLE games_backup AS SELECT * FROM games;
    `);

    await db.exec(`
      CREATE TABLE turns_backup AS SELECT * FROM turns;
    `);

    // Drop existing tables
    await db.exec(`DROP TABLE games;`);
    await db.exec(`DROP TABLE turns;`);

    // Create new games table with updated schema
    await db.exec(`
      CREATE TABLE games (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('setup', 'playing', 'finished')),
        sub_status TEXT NOT NULL CHECK (sub_status IN (
          'waiting_for_players', 'ready_to_start',
          'round_intro', 'turn_starting', 'turn_active', 'turn_paused', 'round_complete',
          'game_complete'
        )),
        host_player_id TEXT NOT NULL,
        team_count INTEGER NOT NULL DEFAULT 2 CHECK (team_count >= 2 AND team_count <= 6),
        phrases_per_player INTEGER NOT NULL DEFAULT 5 CHECK (phrases_per_player >= 1 AND phrases_per_player <= 10),
        timer_duration INTEGER NOT NULL DEFAULT 60 CHECK (timer_duration >= 30 AND timer_duration <= 300),
        current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1 AND current_round <= 3),
        current_team INTEGER NOT NULL DEFAULT 1,
        current_turn_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY (current_turn_id) REFERENCES turns(id)
      );
    `);

    // Create new turns table with updated schema
    await db.exec(`
      CREATE TABLE turns (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        round INTEGER NOT NULL CHECK (round >= 1 AND round <= 3),
        team_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        paused_at TEXT,
        paused_reason TEXT CHECK (paused_reason IN (NULL, 'player_disconnected', 'host_paused', 'dispute')),
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

    // Migrate games data with status/sub_status mapping
    await db.exec(`
      INSERT INTO games (id, name, status, sub_status, host_player_id, team_count, phrases_per_player, 
                        timer_duration, current_round, current_team, current_turn_id, created_at, 
                        updated_at, started_at, finished_at)
      SELECT id, name, 
             CASE 
               WHEN status = 'waiting' THEN 'setup'
               WHEN status = 'phrase_submission' THEN 'setup'
               WHEN status = 'playing' THEN 'playing'
               WHEN status = 'finished' THEN 'finished'
               ELSE 'setup'
             END as status,
             CASE 
               WHEN status = 'waiting' THEN 'waiting_for_players'
               WHEN status = 'phrase_submission' THEN 'waiting_for_players'
               WHEN status = 'playing' THEN 'turn_active'
               WHEN status = 'finished' THEN 'game_complete'
               ELSE 'waiting_for_players'
             END as sub_status,
             host_player_id, team_count, phrases_per_player, timer_duration, 
             current_round, current_team, current_turn_id, created_at, 
             updated_at, started_at, finished_at
      FROM games_backup;
    `);

    // Migrate turns data (add NULL values for new columns)
    await db.exec(`
      INSERT INTO turns (id, game_id, round, team_id, player_id, start_time, end_time, 
                        paused_at, paused_reason, duration, phrases_guessed, phrases_skipped, 
                        points_scored, is_complete, created_at, updated_at)
      SELECT id, game_id, round, team_id, player_id, start_time, end_time, 
             NULL as paused_at, NULL as paused_reason, duration, phrases_guessed, phrases_skipped, 
             points_scored, is_complete, created_at, updated_at
      FROM turns_backup;
    `);

    // Clean up backup tables
    await db.exec(`DROP TABLE games_backup;`);
    await db.exec(`DROP TABLE turns_backup;`);

    // Recreate triggers
    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_games_timestamp 
      AFTER UPDATE ON games 
      BEGIN 
        UPDATE games SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
      END;
    `);

    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_turns_timestamp
      AFTER UPDATE ON turns
      BEGIN
        UPDATE turns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    // Recreate indexes
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_games_host ON games(host_player_id);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_games_current_turn ON games(current_turn_id);`
    );

    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_turns_game ON turns(game_id);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_turns_team ON turns(team_id);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_turns_player ON turns(player_id);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_turns_game_round ON turns(game_id, round);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_turns_complete ON turns(is_complete);`
    );
  },

  down: async db => {
    // Reverse the migration by going back to the old status system
    // Remove paused columns from turns
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

    await db.exec(`
      INSERT INTO turns_new 
      SELECT id, game_id, round, team_id, player_id, start_time, end_time, 
             duration, phrases_guessed, phrases_skipped, points_scored, 
             is_complete, created_at, updated_at
      FROM turns;
    `);

    await db.exec(`DROP TABLE turns;`);
    await db.exec(`ALTER TABLE turns_new RENAME TO turns;`);

    // Revert games table to old status system
    await db.exec(`
      CREATE TABLE games_old (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('waiting', 'phrase_submission', 'playing', 'finished')),
        host_player_id TEXT NOT NULL,
        team_count INTEGER NOT NULL DEFAULT 2 CHECK (team_count >= 2 AND team_count <= 6),
        phrases_per_player INTEGER NOT NULL DEFAULT 5 CHECK (phrases_per_player >= 1 AND phrases_per_player <= 10),
        timer_duration INTEGER NOT NULL DEFAULT 60 CHECK (timer_duration >= 30 AND timer_duration <= 300),
        current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1 AND current_round <= 3),
        current_team INTEGER NOT NULL DEFAULT 1,
        current_turn_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY (current_turn_id) REFERENCES turns(id)
      );
    `);

    // Map back to old status values
    await db.exec(`
      INSERT INTO games_old 
      SELECT id, name, 
             CASE 
               WHEN status = 'setup' AND sub_status = 'waiting_for_players' THEN 'waiting'
               WHEN status = 'setup' AND sub_status = 'ready_to_start' THEN 'phrase_submission'
               WHEN status = 'playing' THEN 'playing'
               WHEN status = 'finished' THEN 'finished'
               ELSE 'waiting'
             END as status,
             host_player_id, team_count, phrases_per_player, timer_duration, 
             current_round, current_team, current_turn_id, created_at, 
             updated_at, started_at, finished_at
      FROM games;
    `);

    await db.exec(`DROP TABLE games;`);
    await db.exec(`ALTER TABLE games_old RENAME TO games;`);

    // Recreate triggers and indexes
    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_games_timestamp 
      AFTER UPDATE ON games 
      BEGIN 
        UPDATE games SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
      END;
    `);

    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_turns_timestamp
      AFTER UPDATE ON turns
      BEGIN
        UPDATE turns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_games_host ON games(host_player_id);`
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_games_current_turn ON games(current_turn_id);`
    );
  },
};

export default migration_004;

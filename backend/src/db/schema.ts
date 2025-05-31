// Database schema definitions for Fishbowl game application

// ==================== TypeScript Interfaces ====================

export interface Game {
  id: string;
  name: string;
  status: 'waiting' | 'phrase_submission' | 'playing' | 'finished';
  host_player_id: string;
  team_count: number;
  phrases_per_player: number;
  timer_duration: number; // seconds
  current_round: number;
  current_team: number;
  current_turn_id?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  team_id?: string;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

export interface Team {
  id: string;
  game_id: string;
  name: string;
  color: string;
  score_round_1: number;
  score_round_2: number;
  score_round_3: number;
  total_score: number;
  created_at: string;
  updated_at: string;
}

export interface Phrase {
  id: string;
  game_id: string;
  player_id: string;
  text: string;
  status: 'active' | 'guessed' | 'skipped';
  guessed_in_round?: number;
  guessed_by_team_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Turn {
  id: string;
  game_id: string;
  round: number;
  team_id: string;
  acting_player_id: string;
  start_time: string;
  end_time?: string;
  duration: number; // seconds
  phrases_guessed: number;
  phrases_skipped: number;
  points_scored: number;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface TurnPhrase {
  id: string;
  turn_id: string;
  phrase_id: string;
  action: 'guessed' | 'skipped' | 'in_progress';
  timestamp: string;
}

// ==================== SQL Schema Definitions ====================

export const CREATE_GAMES_TABLE = `
  CREATE TABLE IF NOT EXISTS games (
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
`;

export const CREATE_PLAYERS_TABLE = `
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    team_id TEXT,
    is_connected BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    UNIQUE(game_id, name)
  );
`;

export const CREATE_TEAMS_TABLE = `
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    score_round_1 INTEGER NOT NULL DEFAULT 0,
    score_round_2 INTEGER NOT NULL DEFAULT 0,
    score_round_3 INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    UNIQUE(game_id, name)
  );
`;

export const CREATE_PHRASES_TABLE = `
  CREATE TABLE IF NOT EXISTS phrases (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'guessed', 'skipped')),
    guessed_in_round INTEGER CHECK (guessed_in_round >= 1 AND guessed_in_round <= 3),
    guessed_by_team_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (guessed_by_team_id) REFERENCES teams(id)
  );
`;

export const CREATE_TURNS_TABLE = `
  CREATE TABLE IF NOT EXISTS turns (
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
`;

export const CREATE_TURN_PHRASES_TABLE = `
  CREATE TABLE IF NOT EXISTS turn_phrases (
    id TEXT PRIMARY KEY,
    turn_id TEXT NOT NULL,
    phrase_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('guessed', 'skipped', 'in_progress')),
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE CASCADE,
    FOREIGN KEY (phrase_id) REFERENCES phrases(id) ON DELETE CASCADE,
    UNIQUE(turn_id, phrase_id)
  );
`;

// ==================== Indexes ====================

export const CREATE_INDEXES = [
  // Games indexes
  `CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);`,
  `CREATE INDEX IF NOT EXISTS idx_games_host ON games(host_player_id);`,
  `CREATE INDEX IF NOT EXISTS idx_games_current_turn ON games(current_turn_id);`,
  
  // Players indexes
  `CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);`,
  `CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);`,
  `CREATE INDEX IF NOT EXISTS idx_players_connected ON players(is_connected);`,
  `CREATE INDEX IF NOT EXISTS idx_players_game_name ON players(game_id, name);`,
  
  // Teams indexes
  `CREATE INDEX IF NOT EXISTS idx_teams_game ON teams(game_id);`,
  `CREATE INDEX IF NOT EXISTS idx_teams_score ON teams(total_score DESC);`,
  
  // Phrases indexes
  `CREATE INDEX IF NOT EXISTS idx_phrases_game ON phrases(game_id);`,
  `CREATE INDEX IF NOT EXISTS idx_phrases_player ON phrases(player_id);`,
  `CREATE INDEX IF NOT EXISTS idx_phrases_status ON phrases(status);`,
  `CREATE INDEX IF NOT EXISTS idx_phrases_game_status ON phrases(game_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_phrases_round_team ON phrases(guessed_in_round, guessed_by_team_id);`,
  
  // Turns indexes
  `CREATE INDEX IF NOT EXISTS idx_turns_game ON turns(game_id);`,
  `CREATE INDEX IF NOT EXISTS idx_turns_team ON turns(team_id);`,
  `CREATE INDEX IF NOT EXISTS idx_turns_player ON turns(acting_player_id);`,
  `CREATE INDEX IF NOT EXISTS idx_turns_game_round ON turns(game_id, round);`,
  `CREATE INDEX IF NOT EXISTS idx_turns_complete ON turns(is_complete);`,
  
  // Turn phrases indexes
  `CREATE INDEX IF NOT EXISTS idx_turn_phrases_turn ON turn_phrases(turn_id);`,
  `CREATE INDEX IF NOT EXISTS idx_turn_phrases_phrase ON turn_phrases(phrase_id);`,
  `CREATE INDEX IF NOT EXISTS idx_turn_phrases_action ON turn_phrases(action);`
];

// ==================== Triggers for updated_at ====================

export const CREATE_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS update_games_timestamp 
   AFTER UPDATE ON games 
   BEGIN 
     UPDATE games SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
   END;`,
   
  `CREATE TRIGGER IF NOT EXISTS update_players_timestamp 
   AFTER UPDATE ON players 
   BEGIN 
     UPDATE players SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
   END;`,
   
  `CREATE TRIGGER IF NOT EXISTS update_teams_timestamp 
   AFTER UPDATE ON teams 
   BEGIN 
     UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
   END;`,
   
  `CREATE TRIGGER IF NOT EXISTS update_phrases_timestamp 
   AFTER UPDATE ON phrases 
   BEGIN 
     UPDATE phrases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
   END;`,
   
  `CREATE TRIGGER IF NOT EXISTS update_turns_timestamp 
   AFTER UPDATE ON turns 
   BEGIN 
     UPDATE turns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
   END;`
];

// ==================== Schema Validation ====================

export const ALL_TABLES = [
  CREATE_GAMES_TABLE,
  CREATE_PLAYERS_TABLE,
  CREATE_TEAMS_TABLE,
  CREATE_PHRASES_TABLE,
  CREATE_TURNS_TABLE,
  CREATE_TURN_PHRASES_TABLE
];

export const SCHEMA_VERSION = 1;
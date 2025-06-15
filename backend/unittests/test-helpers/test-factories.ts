import { Game, Player, Team, Phrase } from '../../src/db/schema';

// ==================== Types ====================

export interface GameConfig {
  teamCount: number;
  phrasesPerPlayer: number;
  timerDuration: number;
}

// ==================== Utility Functions ====================

/**
 * Generate a unique ID for testing
 */
function generateId(prefix: string = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current timestamp in ISO format
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// ==================== Game Factory ====================

export const gameFactory = {  /**
   * Creates a game in setup status, waiting for players
   */
  waiting(overrides: Partial<Game> = {}): Game {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('game'),
      name: 'Test Game',
      status: 'setup',
      sub_status: 'waiting_for_players',
      host_player_id: generateId('host'),
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 1,
      current_team: 1,
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    } as Game;
  },

  /**
   * Creates a game in setup status, ready to start
   */
  phraseSubmission(overrides: Partial<Game> = {}): Game {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('game'),
      name: 'Test Game',
      status: 'setup',
      sub_status: 'waiting_for_players',
      host_player_id: generateId('host'),
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 1,
      current_team: 1,
      created_at: timestamp,
      updated_at: timestamp,
      started_at: timestamp,
      ...overrides
    } as Game;
  },
  /**
   * Creates a game in playing status
   */
  playing(overrides: Partial<Game> = {}): Game {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('game'),
      name: 'Test Game',
      status: 'playing',
      sub_status: 'turn_active',
      host_player_id: generateId('host'),
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 1,
      current_team: 1,
      current_turn_id: generateId('turn'),
      created_at: timestamp,
      updated_at: timestamp,
      started_at: timestamp,
      ...overrides
    } as Game;
  },

  /**
   * Creates a game in finished status
   */
  finished(overrides: Partial<Game> = {}): Game {
    const timestamp = getCurrentTimestamp();
    const startTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    return {
      id: generateId('game'),
      name: 'Test Game',
      status: 'finished',
      sub_status: 'game_complete',
      host_player_id: generateId('host'),
      team_count: 2,
      phrases_per_player: 5,
      timer_duration: 60,
      current_round: 3,
      current_team: 1,
      created_at: startTime,
      updated_at: timestamp,
      started_at: startTime,
      finished_at: timestamp,
      ...overrides
    } as Game;
  },
  /**
   * Creates a game with specific config
   */
  withConfig(config: GameConfig, overrides: Partial<Game> = {}): Game {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('game'),
      name: 'Test Game',
      status: 'setup',
      sub_status: 'waiting_for_players',
      host_player_id: generateId('host'),
      team_count: config.teamCount,
      phrases_per_player: config.phrasesPerPlayer,
      timer_duration: config.timerDuration,
      current_round: 1,
      current_team: 1,
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides
    } as Game;
  }
};

// ==================== Player Factory ====================

export const playerFactory = {
  /**
   * Creates a host player
   */
  host(gameId: string, teamId: string): Player {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('host'),
      game_id: gameId,
      name: 'Host Player',
      team_id: teamId,
      is_connected: true,
      created_at: timestamp,
      updated_at: timestamp,
      last_seen_at: timestamp
    };
  },

  /**
   * Creates a connected player
   */
  connected(gameId: string, teamId: string, name?: string): Player {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('player'),
      game_id: gameId,
      name: name || `Player ${Math.floor(Math.random() * 1000)}`,
      team_id: teamId,
      is_connected: true,
      created_at: timestamp,
      updated_at: timestamp,
      last_seen_at: timestamp
    };
  },

  /**
   * Creates a disconnected player
   */
  disconnected(gameId: string, teamId: string, name?: string): Player {
    const timestamp = getCurrentTimestamp();
    const lastSeen = new Date(Date.now() - 300000).toISOString(); // 5 minutes ago
    return {
      id: generateId('player'),
      game_id: gameId,
      name: name || `Player ${Math.floor(Math.random() * 1000)}`,
      team_id: teamId,
      is_connected: false,
      created_at: timestamp,
      updated_at: timestamp,
      last_seen_at: lastSeen
    };
  },

  /**
   * Returns player with phrase count metadata (for testing purposes)
   */
  withPhrases(player: Player, phraseCount: number): Player & { _phraseCount: number } {
    return {
      ...player,
      _phraseCount: phraseCount
    };
  }
};

// ==================== Team Factory ====================

const DEFAULT_TEAM_NAMES = [
  'Red Team',
  'Blue Team',
  'Green Team',
  'Yellow Team',
  'Purple Team',
  'Orange Team'
];

const DEFAULT_TEAM_COLORS = [
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#800080', // Purple
  '#FFA500'  // Orange
];

export const teamFactory = {
  /**
   * Creates a single team
   */
  create(gameId: string, name: string, color: string): Team {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('team'),
      game_id: gameId,
      name: name,
      color: color,
      score_round_1: 0,
      score_round_2: 0,
      score_round_3: 0,
      total_score: 0,
      created_at: timestamp,
      updated_at: timestamp
    };
  },

  /**
   * Creates multiple teams with default names and colors
   */
  createMultiple(gameId: string, count: number): Team[] {
    if (count > DEFAULT_TEAM_NAMES.length) {
      throw new Error(`Cannot create more than ${DEFAULT_TEAM_NAMES.length} teams with default names`);
    }

    const teams: Team[] = [];
    for (let i = 0; i < count; i++) {
      const teamName = DEFAULT_TEAM_NAMES[i];
      const teamColor = DEFAULT_TEAM_COLORS[i];
      if (!teamName || !teamColor) {
        throw new Error(`Cannot create team ${i + 1}: missing name or color`);
      }
      teams.push(this.create(
        gameId,
        teamName,
        teamColor
      ));
    }
    return teams;
  }
};

// ==================== Phrase Factory ====================

const SAMPLE_PHRASES = [
  'Elephant',
  'Pizza',
  'Superhero',
  'Rainbow',
  'Basketball',
  'Computer',
  'Ocean',
  'Mountain',
  'Butterfly',
  'Guitar',
  'Chocolate',
  'Spaceship',
  'Dragon',
  'Library',
  'Sunset'
];

export const phraseFactory = {
  /**
   * Creates a single phrase
   */
  create(gameId: string, playerId: string, text: string): Phrase {
    const timestamp = getCurrentTimestamp();
    return {
      id: generateId('phrase'),
      game_id: gameId,
      player_id: playerId,
      text: text,
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp
    };
  },

  /**
   * Creates multiple phrases with random text
   */
  createMultiple(gameId: string, playerId: string, count: number): Phrase[] {
    const phrases: Phrase[] = [];
    const shuffledPhrases = [...SAMPLE_PHRASES].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < count; i++) {
      const phraseText = shuffledPhrases[i % shuffledPhrases.length] + (i >= shuffledPhrases.length ? ` ${Math.floor(i / shuffledPhrases.length) + 1}` : '');
      phrases.push(this.create(gameId, playerId, phraseText));
    }
    return phrases;
  },

  /**
   * Returns a phrase marked as guessed
   */
  guessed(phrase: Phrase, round: number = 1, teamId?: string): Phrase {
    return {
      ...phrase,
      status: 'guessed',
      guessed_in_round: round,
      guessed_by_team_id: teamId || '',
      updated_at: getCurrentTimestamp()
    };
  },

  /**
   * Returns a phrase marked as skipped
   */
  skipped(phrase: Phrase): Phrase {
    return {
      ...phrase,
      status: 'skipped',
      updated_at: getCurrentTimestamp()
    };
  }
};

// ==================== Composite Factory Functions ====================

/**
 * Creates a complete game setup with teams and players
 */
export function createGameSetup(config: {
  gameStatus?: Game['status'];
  teamCount?: number;
  playersPerTeam?: number;
  phrasesPerPlayer?: number;
}) {
  const gameConfig: GameConfig = {
    teamCount: config.teamCount || 2,
    phrasesPerPlayer: config.phrasesPerPlayer || 5,
    timerDuration: 60
  };
  const game = gameFactory.withConfig(gameConfig, { 
    status: config.gameStatus || 'setup',
    sub_status: config.gameStatus === 'playing' ? 'turn_active' : 
                config.gameStatus === 'finished' ? 'game_complete' : 'waiting_for_players'
  });
  
  const teams = teamFactory.createMultiple(game.id, gameConfig.teamCount);
  const playersPerTeam = config.playersPerTeam || 2;
  const players: Player[] = [];
  
  // Create host player for first team
  const firstTeam = teams[0];
  if (!firstTeam) throw new Error('No teams created for game setup');
  
  const hostPlayer = playerFactory.host(game.id, firstTeam.id);
  players.push(hostPlayer);
  
  // Update game with host player ID
  game.host_player_id = hostPlayer.id;
  
  // Create additional players for all teams
  teams.forEach((team, teamIndex) => {
    const startIndex = teamIndex === 0 ? 1 : 0; // Skip first player for first team (host)
    for (let i = startIndex; i < playersPerTeam; i++) {
      players.push(playerFactory.connected(game.id, team.id, `Player ${teamIndex + 1}-${i + 1}`));
    }
  });

  return {
    game,
    teams,
    players,
    hostPlayer
  };
}
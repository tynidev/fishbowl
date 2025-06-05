/**
 * @fileoverview Test Helpers - Comprehensive utilities for testing the Fishbowl game backend
 *
 * This module provides a complete set of testing utilities including:
 * - Mock database setup and transaction handling
 * - Factory functions for creating test data objects
 * - High-level scenario builders for complex test setups
 * - Common assertion helpers for API responses
 * - Performance-optimized patterns for test organization
 *
 * @example Basic usage - Setting up a simple test
 * ```typescript
 * import { setupTestApp, createMockGame, mockGameLookup, resetAllMocks } from '../test-helpers';
 *
 * describe('Game API', () => {
 *   let app: Application;
 *
 *   beforeEach(() => {
 *     app = setupTestApp();
 *     resetAllMocks();
 *   });
 *
 *   it('should get game details', async () => {
 *     const game = createMockGame({ id: 'TEST123', name: 'My Test Game' });
 *     mockGameLookup(game);
 *
 *     const response = await request(app).get('/api/games/TEST123');
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 *
 * @example Advanced usage - Complete game scenario
 * ```typescript
 * import { setupGameWithPlayers, expectGameNotFound } from '../test-helpers';
 *
 * describe('Complex Game Operations', () => {
 *   it('should handle multi-player operations', async () => {
 *     // Creates game, teams, players and sets up all mocks
 *     const scenario = setupGameWithPlayers({
 *       gameCode: 'ABC123',
 *       playerCount: 6,
 *       teamCount: 3,
 *       gameStatus: 'waiting'
 *     });
 *
 *     // Test operations with the scenario
 *     const response = await request(app).get(`/api/games/${scenario.game.id}`);
 *     expect(response.body.teams).toHaveLength(3);
 *     expect(response.body.players).toHaveLength(6);
 *   });
 * });
 * ```
 *
 * @example Performance patterns
 * ```typescript
 * // GOOD: Consolidated beforeEach for better performance
 * beforeEach(() => {
 *   app = setupTestApp();
 *   mockTransaction = setupMockTransaction();
 *   resetAllMocks(); // Resets all mocks efficiently
 * });
 *
 * // AVOID: Multiple beforeEach hooks
 * beforeEach(() => app = setupTestApp());
 * beforeEach(() => mockTransaction = setupMockTransaction());
 * beforeEach(() => jest.clearAllMocks());
 * ```
 *
 * @author Fishbowl Development Team
 * @since v1.0.0
 */

import {
  Player,
  Game,
  Team,
  Phrase,
  // Round,
  // Turn,
  // GameConfig,
  // DeviceSession
} from '../src/db/schema';

import {
  // Add specific types from rest-api as needed, e.g.:
  // CreateGameRequest,
  // CreateGameResponse,
  // JoinGameRequest,
  // JoinGameResponse,
  // PlayerState,
  // GameState,
  // TeamState,
  // PhraseState,
  // RoundState,
  // TurnState,
  // GameConfigState,
  // ErrorResponse
} from '../src/types/rest-api';

// ==================== TypeScript Interfaces for Helper Functions ====================

/**
 * Options for creating a complete game scenario with teams and players
 */
export interface GameScenarioOptions {
  /** Number of teams to create (default: 2) */
  teamCount?: number;
  /** Number of players to create (default: 4) */
  playerCount?: number;
  /** Game status (default: 'waiting') */
  gameStatus?: 'waiting' | 'phrase_submission' | 'playing' | 'finished';
  /** Game code (default: generated) */
  gameCode?: string;
  /** Game name (default: 'Test Game') */
  gameName?: string;
  /** Host player name (default: 'Host Player') */
  hostPlayerName?: string;
  /** Number of phrases per player (default: 5) */
  phrasesPerPlayer?: number;
  /** Timer duration in seconds (default: 60) */
  timerDuration?: number;
  /** Current round (default: 1) */
  currentRound?: number;
  /** Current team (default: 1) */
  currentTeam?: number;
}

/**
 * Options for creating a player assigned to a team
 */
export interface PlayerInTeamOptions {
  /** Game ID the player belongs to */
  gameId: string;
  /** Team ID the player is assigned to */
  teamId: string;
  /** Player name (default: generated) */
  playerName?: string;
  /** Whether this player is the host (default: false) */
  isHost?: boolean;
  /** Whether the player is connected (default: true) */
  isConnected?: boolean;
}

/**
 * Options for setting up a game with players and teams
 */
export interface SetupGameOptions {
  /** Game code */
  gameCode: string;
  /** Number of players to create */
  playerCount: number;
  /** Number of teams to create */
  teamCount: number;
  /** Game status (default: 'waiting') */
  gameStatus?: 'waiting' | 'phrase_submission' | 'playing' | 'finished';
  /** Host player ID (default: generated) */
  hostPlayerId?: string;
  /** Game name (default: 'Test Game') */
  gameName?: string;
  /** Number of phrases per player (default: 5) */
  phrasesPerPlayer?: number;
  /** Timer duration in seconds (default: 60) */
  timerDuration?: number;
}

// ==================== Mock Setup Helpers ====================

// Import necessary modules for mocking
import express, { Application } from 'express';
import { jest } from '@jest/globals';
import * as dbUtils from '../src/db/utils';
import * as dbConnection from '../src/db/connection';
import router from '../src/routes/index';

// Mock the database modules
jest.mock('../src/db/utils');
jest.mock('../src/db/connection');

export const mockedDbUtils = dbUtils as jest.Mocked<typeof dbUtils>;
export const mockedDbConnection = dbConnection as jest.Mocked<typeof dbConnection>;
/**
 * Setup Express app with game routes for testing
 */
export function setupTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

/**
 * Setup mock transaction for database operations
 */
export function setupMockTransaction() {
  const mockTransaction = {
    db: {} as any,
    commit: jest.fn(),
    rollback: jest.fn(),
    close: jest.fn(),
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    exec: jest.fn(),
    serialize: jest.fn(),
    isHealthy: jest.fn(),
  } as any;

  mockedDbConnection.withTransaction.mockImplementation(async (callback) => {
    return await callback(mockTransaction);
  });

  return mockTransaction;
}

/**
 * Setup mock connection for database operations
 */
export function setupMockConnection(){
  const mockConnection = {
    db: {} as any,
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    exec: jest.fn(),
    serialize: jest.fn(),
    close: jest.fn(),
    isHealthy: jest.fn(), 
  } as any;

  mockedDbConnection.withConnection.mockImplementation(async (callback) => {
      return await callback(mockConnection);
  });

  return mockConnection;
}

/**
 * Reset all mocks - call this in beforeEach
 */
export function resetAllMocks() {
  jest.clearAllMocks();
}

/**
 * Create a mock game object for testing
 */
export function createMockGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'ABC123',
    name: 'Test Game',
    status: 'waiting',
    host_player_id: 'host-id',
    team_count: 2,
    phrases_per_player: 5,
    timer_duration: 60,
    current_round: 1,
    current_team: 1,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    ...overrides
  };
}

/**
 * Create a mock player object for testing
 */
export function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    game_id: 'ABC123',
    name: 'Test Player',
    team_id: 'team-1',
    is_connected: true,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    last_seen_at: '2023-01-01T00:00:00Z',
    ...overrides
  };
}

/**
 * Create a mock team object for testing
 */
export function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    game_id: 'ABC123',
    name: 'Red Team',
    color: '#FF0000',
    score_round_1: 0,
    score_round_2: 0,
    score_round_3: 0,
    total_score: 0,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    ...overrides
  };
}

/**
 * Create a mock phrase object for testing
 */
export function createMockPhrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: 'phrase-1',
    game_id: 'ABC123',
    player_id: 'player-1',
    text: 'Test Phrase',
    status: 'active',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    ...overrides
  };
}

/**
 * Mock database lookup for a specific game
 * Sets up mockedDbUtils.findById to return the provided game when called with the game's ID
 */
export function mockGameLookup(game: Game): void {
  mockedDbUtils.findById.mockResolvedValue(game);
}

/**
 * Mock database lookup for a specific player
 * Sets up mockedDbUtils.findById to return the provided player when called with the player's ID
 */
export function mockPlayerLookup(player: Player): void {
  mockedDbUtils.findById.mockResolvedValue(player);
}

/**
 * Mock database lookup for a specific team
 * Sets up mockedDbUtils.findById to return the provided team when called with the team's ID
 */
export function mockTeamLookup(team: Team): void {
  mockedDbUtils.findById.mockResolvedValue(team);
}

/**
 * Mock database lookup for a specific phrase
 * Sets up mockedDbUtils.findById to return the provided phrase when called with the phrase's ID
 */
export function mockPhraseLookup(phrase: Phrase): void {
  mockedDbUtils.findById.mockResolvedValue(phrase);
}

/**
 * Mock database collection query for players in a specific game
 * Sets up mockedDbUtils.select to return the provided players when queried for players in the specified game
 */
export function mockPlayersInGame(gameCode: string, players: Player[]): void {
  mockedDbUtils.select.mockResolvedValue(players);
}

/**
 * Mock database collection query for teams in a specific game
 * Sets up mockedDbUtils.select to return the provided teams when queried for teams in the specified game
 */
export function mockTeamsInGame(gameCode: string, teams: Team[]): void {
  mockedDbUtils.select.mockResolvedValue(teams);
}

/**
 * Mock database collection query for phrases belonging to a specific player
 * Sets up mockedDbUtils.select to return the provided phrases when queried for phrases by the specified player
 */
export function mockPhrasesForPlayer(playerId: string, phrases: Phrase[]): void {
  mockedDbUtils.select.mockResolvedValue(phrases);
}

/**
 * Mock database collection query for phrases in a specific game
 * Sets up mockedDbUtils.select to return the provided phrases when queried for phrases in the specified game
 */
export function mockPhrasesInGame(gameCode: string, phrases: Phrase[]): void {
  mockedDbUtils.select.mockResolvedValue(phrases);
}

/**
 * Mocks database select queries with dynamic implementation
 * This function sets up mockedDbUtils.select to return different entities based on the table name
 */
export function setupDynamicSelectMock(
  games: Record<string, Game> = {},
  players: Record<string, Player> = {},
  teams: Record<string, Team> = {},
  phrases: Record<string, Phrase> = {}
): void {
  mockedDbUtils.select.mockImplementation(
    async <T = any>(tableName: string, _options?: dbUtils.QueryOptions, _connection?: any): Promise<T[]> => {
      switch (tableName) {
        case 'games':
          return games && Object.keys(games).length > 0 ? (Object.values(games) as unknown as T[]) : [];
        case 'players':
            return players && Object.keys(players).length > 0 ? (Object.values(players) as unknown as T[]) : [];
        case 'teams':
          return teams && Object.keys(teams).length > 0 ? (Object.values(teams) as unknown as T[]) : [];
        case 'phrases':
          return phrases && Object.keys(phrases).length > 0 ? (Object.values(phrases) as unknown as T[]) : [];
        default:
          return [] as T[];
      }
    }
  );
}


/**
 * Mock database lookup with dynamic implementation based on table and ID
 * Sets up mockedDbUtils.findById to return different entities based on the table name and ID
 */
export function setupDynamicFindByIdMock(
  games: Record<string, Game> = {},
  players: Record<string, Player> = {},
  teams: Record<string, Team> = {},
  phrases: Record<string, Phrase> = {}
): void {
  mockedDbUtils.findById.mockImplementation(async <T = any>(tableName: string, id: string, _connection?: any): Promise<T | undefined> => {
    switch (tableName) {
      case 'games':
        return (games[id] as T) || undefined;
      case 'players':
        return (players[id] as T) || undefined;
      case 'teams':
        return (teams[id] as T) || undefined;
      case 'phrases':
        return (phrases[id] as T) || undefined;
      default:
        return undefined;
    }
  });
}

export function setupDynamicUpdateMock(
  games: Record<string, Game> = {},
  players: Record<string, Player> = {},
  teams: Record<string, Team> = {},
  phrases: Record<string, Phrase> = {}
): void {
  mockedDbUtils.update.mockImplementation(async <T extends Record<string, any>>(tableName: string, data: T, conditions: any[], _connection?: any): Promise<number> => {
    // Find the id from the conditions array (assuming condition is { field: 'id', value: ... })
    const idCondition = conditions.find((cond: any) => cond.field === 'id');
    const id = idCondition ? idCondition.value : undefined;
    if (!id) {
      return 0; // No ID provided, nothing to update
    }
    switch (tableName) {
      case 'games':
        if (id && games[id]) {
          games[id] = { ...games[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      case 'players':
        if (id && players[id]) {
          players[id] = { ...players[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      case 'teams':
        if (id && teams[id]) {
          teams[id] = { ...teams[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      case 'phrases':
        if (id && phrases[id]) {
          phrases[id] = { ...phrases[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      default:
        return 0;
    }
  });
}

/**
 * Create a mock data store for use with setupDynamicFindByIdMock
 * This helper makes it easy to build the data structures needed
 */
export function createMockDataStoreFromScenario(scenario: { game: Game; players: Player[]; teams: Team[]; phrases?: Phrase[] }) {
  const store = {
    games: { [scenario.game.id]: scenario.game } as Record<string, Game>,
    players: {} as Record<string, Player>,
    teams: {} as Record<string, Team>,
    phrases: {} as Record<string, Phrase>,

    addGame(game: Game) {
      this.games[game.id] = game;
      return this;
    },

    addPlayer(player: Player) {
      this.players[player.id] = player;
      return this;
    },

    addTeam(team: Team) {
      this.teams[team.id] = team;
      return this;
    },

    addPhrase(phrase: Phrase) {
      this.phrases[phrase.id] = phrase;
      return this;
    },

    setupMocks() {
      setupDynamicFindByIdMock(this.games, this.players, this.teams, this.phrases);
      setupDynamicSelectMock(this.games, this.players, this.teams, this.phrases);
      setupDynamicUpdateMock(this.games, this.players, this.teams, this.phrases);
      return this;
    }
  };

  scenario.players.forEach(player => store.addPlayer(player));
  scenario.teams.forEach(team => store.addTeam(team));
  if (scenario.phrases) {
    scenario.phrases.forEach(phrase => store.addPhrase(phrase));
  }

  return store;
}

/**
 * Create a mock data store for use with setupDynamicFindByIdMock
 * This helper makes it easy to build the data structures needed
 */
export function createMockDataStore() {
  return {
    games: {} as Record<string, Game>,
    players: {} as Record<string, Player>,
    teams: {} as Record<string, Team>,
    phrases: {} as Record<string, Phrase>,
    
    addGame(game: Game) {
      this.games[game.id] = game;
      return this;
    },
    
    addPlayer(player: Player) {
      this.players[player.id] = player;
      return this;
    },
    
    addTeam(team: Team) {
      this.teams[team.id] = team;
      return this;
    },
    
    addPhrase(phrase: Phrase) {
      this.phrases[phrase.id] = phrase;
      return this;
    },
    
    setupMocks() {
      setupDynamicFindByIdMock(this.games, this.players, this.teams, this.phrases);
      setupDynamicSelectMock(this.games, this.players, this.teams, this.phrases);
      return this;
    }
  };
}

// ==================== Test Scenario Builders ====================

/**
 * Create a complete game scenario with teams, players, and host
 * Returns all the related entities for easy test setup
 */
export function createGameScenario(options: GameScenarioOptions = {}) {
  const {
    teamCount = 2,
    playerCount = 4,
    gameStatus = 'waiting',
    gameCode = 'ABC123',
    gameName = 'Test Game',
    hostPlayerName = 'Host Player',
    phrasesPerPlayer = 5,
    timerDuration = 60,
    currentRound = 1,
    currentTeam = 1
  } = options;


  // Create the game
  const game = createMockGame({
    id: gameCode,
    name: gameName,
    status: gameStatus,
    team_count: teamCount,
    phrases_per_player: phrasesPerPlayer,
    timer_duration: timerDuration,
    current_round: currentRound,
    current_team: currentTeam,
    host_player_id: 'host-player-id'
  });

  // Create teams
  const teams: Team[] = [];
  const teamColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
  const teamNames = ['Red Team', 'Blue Team', 'Green Team', 'Yellow Team', 'Purple Team', 'Cyan Team'];

  for (let i = 0; i < teamCount; i++) {
    teams.push(createMockTeam({
      id: `team-${i + 1}`,
      game_id: gameCode,
      name: teamNames[i] || `Team ${i + 1}`,
      color: teamColors[i] || `#${Math.floor(Math.random()*16777215).toString(16)}`
    }));
  }

  // Create players and distribute across teams
  const players: Player[] = [];
  const firstTeam = teams[0];
  if (!firstTeam) throw new Error('No teams available for host player');

  const hostPlayer = createMockPlayer({
    id: 'host-player-id',
    game_id: gameCode,
    name: hostPlayerName,
    team_id: firstTeam.id,
    is_connected: true
  });
  players.push(hostPlayer);

  // Create remaining players and distribute across teams
  for (let i = 1; i < playerCount; i++) {
    const teamIndex = i % teamCount;
    const team = teams[teamIndex];
    if (!team) throw new Error(`Team at index ${teamIndex} not found`);
    
    players.push(createMockPlayer({
      id: `player-${i + 1}`,
      game_id: gameCode,
      name: `Player ${i + 1}`,
      team_id: team.id,
      is_connected: true
    }));
  }

  // Update game with host player ID
  game.host_player_id = hostPlayer.id;

  return {
    game,
    teams,
    players,
    hostPlayer
  };
}

/**
 * Create a player assigned to a specific team
 * Useful for adding individual players to existing game scenarios
 */
export function createPlayerInTeam(options: PlayerInTeamOptions): Player {
  const {
    gameId,
    teamId,
    playerName = `Player ${Date.now()}`,
    isHost = false,
    isConnected = true
  } = options;


  return createMockPlayer({
    id: isHost ? 'host-player-id' : `player-${Date.now()}`,
    game_id: gameId,
    name: playerName,
    team_id: teamId,
    is_connected: isConnected
  });
}

/**
 * Set up a complete game scenario with mocked database lookups
 * This function creates the scenario AND sets up all the necessary mocks
 */
export function setupGameWithPlayers(options: SetupGameOptions) {
  const {
    gameCode,
    playerCount,
    teamCount,
    gameStatus = 'waiting',
    hostPlayerId,
    gameName = 'Test Game',
    phrasesPerPlayer = 5,
    timerDuration = 60
  } = options;

  // Create the complete scenario
  const scenario = createGameScenario({
    teamCount,
    playerCount,
    gameStatus,
    gameCode,
    gameName,
    phrasesPerPlayer,
    timerDuration
  });

  // Override host player ID if provided
  if (hostPlayerId) {
    scenario.hostPlayer.id = hostPlayerId;
    scenario.game.host_player_id = hostPlayerId;
    // Update the host player in the players array
    const hostIndex = scenario.players.findIndex(p => p.id === 'host-player-id');
    if (hostIndex >= 0 && scenario.players[hostIndex]) {
      scenario.players[hostIndex]!.id = hostPlayerId;
    }
  }

  // Create data stores for dynamic lookup
  const games: Record<string, Game> = { [scenario.game.id]: scenario.game };
  const players: Record<string, Player> = {};
  const teams: Record<string, Team> = {};
  
  // Add all players to the store
  scenario.players.forEach(player => {
    players[player.id] = player;
  });
  
  // Add all teams to the store
  scenario.teams.forEach(team => {
    teams[team.id] = team;
  });
  
  // Setup the dynamic mock
  setupDynamicFindByIdMock(games, players, teams, {});
  
  // Also setup select mock for collections
  setupDynamicSelectMock(games, players, teams, {});
  
  return scenario;
}

// ==================== Helper Functions for Common Test Patterns ====================

/**
 * Assert that a response indicates a game was not found
 * @param response - The supertest response object
 */
export function expectGameNotFound(response: any): void {
  expect(response.status).toBe(404);
  expect(response.body.error).toBe('Game not found');
}

/**
 * Assert that a response indicates an invalid game code
 * @param response - The supertest response object
 */
export function expectInvalidGameCode(response: any): void {
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Invalid game code');
}

/**
 * Assert that a response indicates a player is not in the game
 * @param response - The supertest response object
 */
export function expectPlayerNotInGame(response: any): void {
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Player not found in this game');
}

/**
 * Assert that a response indicates the game has already started
 * @param response - The supertest response object
 */
export function expectGameAlreadyStarted(response: any): void {
  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/after game has started/);
}
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

import { PlayersResponse } from '../src/types/rest-api';

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

// Update imports
import { initializeTestDatabase } from '../src/db/init';
import { withTransaction } from '../src/db/connection';

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
  // No longer needed - using real transactions
  return {};
}

/**
 * Reset all mocks - call this in beforeEach
 */
export async function resetAllMocks() {
  // Clear all data from test database
  await withTransaction(async (transaction) => {
    await transaction.run('DELETE FROM phrases');
    await transaction.run('DELETE FROM players');
    await transaction.run('DELETE FROM teams');
    await transaction.run('DELETE FROM games');
  });
  
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

// ==================== Test Scenario Builders ====================

/**
 * Result of creating a game scenario with all related entities
 */
export interface GameScenario {
  game: Game;
  teams: Team[];
  players: Player[];
  hostPlayer: Player;
}

/**
 * Create a complete game scenario with teams, players, and host
 * Returns all the related entities for easy test setup
 */
export function createGameScenario(options: GameScenarioOptions = {}): GameScenario {
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
    is_connected: Boolean(isConnected)
  });
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

/**
 * Assert that a response contains a valid players list and matches expected players
 * Validates the PlayersResponse structure and performs deep comparison of player data
 * including team assignments.
 * 
 * @param playersListResponse - The API response from /api/games/:gameCode/players
 * @param expectedPlayers - Array of expected Player objects from the database
 * @param expectedTeams - Array of Team objects for validating team assignments
 */
export function expectValidPlayersResponse(playersListResponse: any, expectedPlayers: Player[], expectedTeams: Team[]): void {
  // Basic structure validation
  expect(playersListResponse.body).toBeDefined();
  expect(playersListResponse.body).toHaveProperty('players');
  expect(playersListResponse.body).toHaveProperty('totalCount', expectedPlayers.length);

  // Validate players array
  const actualPlayers = playersListResponse.body.players;
  expect(Array.isArray(actualPlayers)).toBe(true);
  expect(actualPlayers).toHaveLength(expectedPlayers.length);
  
  // Deep comparison of players
  const responsePlayersSorted = [...actualPlayers].sort((a, b) => a.id.localeCompare(b.id));
  const expectedPlayersSorted = [...expectedPlayers].sort((a, b) => a.id.localeCompare(b.id));
  
  expectedPlayersSorted.forEach((expectedPlayer, index) => {
    const actualPlayer = responsePlayersSorted[index];
    
    // Compare each field
    expect(actualPlayer.id).toBe(expectedPlayer.id);
    expect(actualPlayer.name).toBe(expectedPlayer.name);
    expect(actualPlayer.teamId).toBe(expectedPlayer.team_id || undefined);
    expect(actualPlayer.isConnected).toBe(expectedPlayer.is_connected);
    expect(actualPlayer.joinedAt).toBe(expectedPlayer.created_at);
    
    // Validate team assignments match the teams array
    if (actualPlayer.teamId) {
      expect(actualPlayer.teamName).toBeDefined();
      expect(typeof actualPlayer.teamName).toBe('string');
      
      // Find the corresponding team and verify the name matches
      const expectedTeam = expectedTeams.find(team => team.id === actualPlayer.teamId);
      expect(expectedTeam).toBeDefined();
      expect(actualPlayer.teamName).toBe(expectedTeam!.name);
    } else {
      expect(actualPlayer.teamName).toBeUndefined();
    }
  });
}

/**
 * Validates that a join game response matches the expected structure and data
 * @param response - The response object from the join game endpoint
 * @param scenario - The game scenario containing expected data
 * @param playerName - The name of the player who joined
 */
export function expectValidJoinGameResponse(
  response: any,
  scenario: GameScenario,
  playerName: string,
): void {
  // Basic response structure validation
  expect(response.body).toHaveProperty('playerId');
  expect(response.body).toHaveProperty('playerName', playerName);
  expect(response.body).toHaveProperty('teamId');
  expect(response.body).toHaveProperty('teamName');
  expect(response.body).toHaveProperty('gameInfo');

  // Team validation - verify the assigned team exists in scenario
  expect(scenario.teams!.map(t => t.id)).toContain(response.body.teamId);
  expect(scenario.teams!.map(t => t.name)).toContain(response.body.teamName);

  // Game info validation
  const { gameInfo } = response.body;
  expect(gameInfo.id).toBe(scenario.game.id);
  expect(gameInfo.name).toBe(scenario.game.name);
  expect(gameInfo.status).toBe(scenario.game.status);
  expect(gameInfo.playerCount).toBe(scenario.players.length + 1); // existing players + new player
  expect(gameInfo.teamCount).toBe(scenario.teams.length);
  expect(gameInfo.phrasesPerPlayer).toBe(scenario.game.phrases_per_player);
  expect(gameInfo.timerDuration).toBe(scenario.game.timer_duration);
}

/**
 * Ensure the test database is initialized
 */
export async function ensureTestDatabase() {
  await initializeTestDatabase();
}
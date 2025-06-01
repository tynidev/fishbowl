import express, { Application } from 'express';
import { jest } from '@jest/globals';
import gameRoutes from '../../src/routes/REST-API';
import * as dbUtils from '../../src/db/utils';
import * as dbConnection from '../../src/db/connection';
import { Game, Player, Team, Phrase } from '../../src/db/schema';
import { exec } from 'child_process';
import { serialize } from 'v8';
import { close } from 'fs';

// Mock the database modules
jest.mock('../../src/db/utils');
jest.mock('../../src/db/connection');

export const mockedDbUtils = dbUtils as jest.Mocked<typeof dbUtils>;
export const mockedDbConnection = dbConnection as jest.Mocked<typeof dbConnection>;

/**
 * Setup Express app with game routes for testing
 */
export function setupTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api', gameRoutes);
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

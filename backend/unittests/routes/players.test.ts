import request from 'supertest';
import { Application } from 'express';
import {
  setupTestApp,
  resetAllMocks,
  createMockGame,
  createMockTeam,
  setupGameWithPlayers,
  createMockDataStore,
} from '../test-helpers';
import { playerFactory } from '../test-factories';

describe('Players API', () => {
  let app: Application;

  beforeEach(() => {
    app = setupTestApp();
    resetAllMocks();
  });

  describe('GET /api/games/:gameCode/players', () => {
    const gameCode = 'ABC123';

    it('should return players list successfully', async () => {
      const scenario = setupGameWithPlayers({
        gameCode,
        teamCount: 2,
        playerCount: 2,
        gameStatus: 'waiting'
      });

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      // Use common assertion pattern for player lists
      expectValidPlayersResponse(response, scenario.players.length);
      
      // Verify specific player data structure
      expect(response.body.players).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            teamId: expect.any(String),
            teamName: expect.any(String),
            isConnected: expect.any(Boolean),
            joinedAt: expect.any(String)
          })
        ])
      );
    });

    it('should handle mixed connection states correctly', async () => {
      // Create players with different connection states using factories
      const connectedPlayer = playerFactory.connected(gameCode, 'team-1', 'Connected Player');
      const disconnectedPlayer = playerFactory.disconnected(gameCode, 'team-2', 'Disconnected Player');

      const store = createMockDataStore()
        .addGame(createMockGame({
          id: gameCode,
          name: 'Test Game',
          status: 'waiting',
          host_player_id: connectedPlayer.id
        }))
        .addPlayer(connectedPlayer)
        .addPlayer(disconnectedPlayer)
        .addTeam(createMockTeam({ id: 'team-1', game_id: gameCode, name: 'Team 1', color: '#FF0000' }))
        .addTeam(createMockTeam({ id: 'team-2', game_id: gameCode, name: 'Team 2', color: '#0000FF' }))
        .setupMocks();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      const connectedPlayers = response.body.players.filter((p: any) => p.isConnected);
      const disconnectedPlayers = response.body.players.filter((p: any) => !p.isConnected);

      expect(connectedPlayers.length).toBeGreaterThan(0);
      expect(disconnectedPlayers.length).toBeGreaterThan(0);
    });

    it('should include team assignments in response', async () => {
      // Use createGameScenario for setup
      const scenario = setupGameWithPlayers({
        gameCode,
        teamCount: 2,
        playerCount: 2,
        gameStatus: 'waiting'
      });

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      response.body.players.forEach((player: any) => {
        expect(player.teamId).toBeDefined();
        expect(player.teamName).toBeDefined();
        expect(scenario.teams.some(team => team.id === player.teamId)).toBe(true);
      });
    });

    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .get('/api/games/INVALID/players')
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    it('should return 404 for non-existent game', async () => {
      const scenario = setupGameWithPlayers({
        gameCode,
        teamCount: 2,
        playerCount: 2,
        gameStatus: 'waiting'
      });

      const response = await request(app)
        .get(`/api/games/XXXXXX/players`)
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });
  });
});

// ==================== Common Assertion Helpers ====================

/**
 * Assert that a response contains a valid players list
 */
function expectValidPlayersResponse(response: any, expectedCount: number): void {
  expect(response.body).toHaveProperty('players');
  expect(response.body).toHaveProperty('totalCount', expectedCount);
  expect(Array.isArray(response.body.players)).toBe(true);
  expect(response.body.players).toHaveLength(expectedCount);
}

import request from 'supertest';
import { Application } from 'express';
import {
  setupTestApp,
  setupMockTransaction,
  resetAllMocks,
  mockedDbUtils,
  createMockGame,
  createMockTeam
} from './test-utils';
import {
  CreateGameRequest,
  JoinGameRequest
} from '../../src/routes/REST-API';
import { Game, Player, Team } from '../../src/db/schema';

describe('Games API', () => {
  let app: Application;
  let mockTransaction: any;

  beforeEach(() => {
    app = setupTestApp();
    mockTransaction = setupMockTransaction();
    resetAllMocks();
  });

  describe('POST /api/games', () => {
    const validCreateGameRequest: CreateGameRequest = {
      name: 'Test Game',
      hostPlayerName: 'Host Player',
      teamCount: 2,
      phrasesPerPlayer: 5,
      timerDuration: 60
    };

    beforeEach(() => {
      // Mock that no game code exists (for unique code generation)
      mockedDbUtils.exists.mockResolvedValue(false);
      mockedDbUtils.insert.mockResolvedValue('mocked-id');
    });

    it('should create a new game successfully', async () => {
      const response = await request(app)
        .post('/api/games')
        .send(validCreateGameRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        gameCode: expect.any(String),
        gameId: expect.any(String),
        hostPlayerId: expect.any(String),
        config: {
          name: 'Test Game',
          teamCount: 2,
          phrasesPerPlayer: 5,
          timerDuration: 60
        }
      });

      expect(response.body.gameCode).toHaveLength(6);
      expect(mockedDbUtils.insert).toHaveBeenCalledTimes(4); // game, 2 teams, player
    });

    it('should use default values for optional parameters', async () => {
      const minimalRequest = {
        name: 'Test Game',
        hostPlayerName: 'Host Player'
      };

      const response = await request(app)
        .post('/api/games')
        .send(minimalRequest)
        .expect(201);

      expect(response.body.config).toMatchObject({
        teamCount: 2,
        phrasesPerPlayer: 5,
        timerDuration: 60
      });
    });

    it('should return 400 for missing game name', async () => {
      const invalidRequest = {
        hostPlayerName: 'Host Player'
      };

      const response = await request(app)
        .post('/api/games')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Game name is required');
    });

    it('should return 400 for empty game name', async () => {
      const invalidRequest = {
        name: '   ',
        hostPlayerName: 'Host Player'
      };

      const response = await request(app)
        .post('/api/games')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Game name is required');
    });

    it('should return 400 for invalid host player name', async () => {
      const invalidRequest = {
        name: 'Test Game',
        hostPlayerName: ''
      };

      const response = await request(app)
        .post('/api/games')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Player name is required');
    });

    it('should return 400 for invalid team count', async () => {
      const invalidRequest = {
        ...validCreateGameRequest,
        teamCount: 1
      };

      const response = await request(app)
        .post('/api/games')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid game configuration');
      expect(response.body.details).toContain('Team count must be an integer between 2 and 8');
    });

    it('should return 400 for invalid phrases per player', async () => {
      const invalidRequest = {
        ...validCreateGameRequest,
        phrasesPerPlayer: 15
      };

      const response = await request(app)
        .post('/api/games')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid game configuration');
      expect(response.body.details).toContain('Phrases per player must be an integer between 3 and 10');
    });

    it('should return 400 for invalid timer duration', async () => {
      const invalidRequest = {
        ...validCreateGameRequest,
        timerDuration: 300
      };

      const response = await request(app)
        .post('/api/games')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid game configuration');
      expect(response.body.details).toContain('Timer duration must be an integer between 30 and 180 seconds');
    });

    it('should handle database errors gracefully', async () => {
      mockedDbUtils.insert.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/games')
        .send(validCreateGameRequest)
        .expect(500);

      expect(response.body.error).toBe('Failed to create game');
      expect(response.body.message).toBe('Database error');
    });
  });

  describe('POST /api/games/:gameCode/join', () => {
    const gameCode = 'ABC123';
    const validJoinRequest: JoinGameRequest = {
      playerName: 'Test Player'
    };

    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'waiting',
      host_player_id: 'host-id'
    });

    const mockTeam = createMockTeam({
      id: 'team-1',
      game_id: gameCode,
      name: 'Team 1',
      color: '#FF0000'
    });

    beforeEach(() => {
      mockedDbUtils.findById.mockResolvedValue(mockGame);
      mockedDbUtils.select
        .mockResolvedValueOnce([]) // No existing player
        .mockResolvedValueOnce([mockTeam]) // Teams for assignment
        .mockResolvedValueOnce([]) // Players in teams for assignment
        .mockResolvedValueOnce([{ id: 'player-1' }]); // All players for count
      mockedDbUtils.insert.mockResolvedValue('new-player-id');
    });

    it('should allow new player to join game successfully', async () => {
      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send(validJoinRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        playerId: expect.any(String),
        playerName: 'Test Player',
        gameInfo: {
          id: gameCode,
          name: 'Test Game',
          status: 'waiting',
          playerCount: 1,
          teamCount: 2,
          phrasesPerPlayer: 5,
          timerDuration: 60
        }
      });
    });

    it('should allow existing player to reconnect', async () => {
      const existingPlayer: Player = {
        id: 'existing-player-id',
        game_id: gameCode,
        name: 'Test Player',
        team_id: 'team-1',
        is_connected: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        last_seen_at: '2023-01-01T00:00:00Z'
      };

      // Reset select mock to clear any implementations from beforeEach
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Game lookup
        .mockResolvedValueOnce(mockTeam); // Team info lookup

      mockedDbUtils.select
        .mockResolvedValueOnce([existingPlayer]) // Existing player check
        .mockResolvedValueOnce([{ id: 'player-1' }]); // All players for count

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send(validJoinRequest)
        .expect(200);

      expect(response.body.playerId).toBe('existing-player-id');
      expect(response.body.teamId).toBe('team-1');
      expect(response.body.teamName).toBe('Team 1');
    });

    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .post('/api/games/INVALID/join')
        .send(validJoinRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    it('should return 404 for non-existent game', async () => {
      mockedDbUtils.findById.mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send(validJoinRequest)
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });

    it('should return 400 for game that is not accepting players', async () => {
      const finishedGame = { ...mockGame, status: 'finished' as const };
      mockedDbUtils.findById.mockResolvedValue(finishedGame);

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send(validJoinRequest)
        .expect(400);

      expect(response.body.error).toBe('Game is no longer accepting new players');
    });

    it('should return 400 for invalid player name', async () => {
      const invalidRequest = {
        playerName: ''
      };

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Player name is required');
    });

    it('should handle database errors gracefully', async () => {
      mockedDbUtils.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send(validJoinRequest)
        .expect(500);

      expect(response.body.error).toBe('Failed to join game');
    });
  });

  describe('GET /api/games/:gameCode', () => {
    const gameCode = 'ABC123';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'waiting',
      host_player_id: 'host-id'
    });

    beforeEach(() => {
      // Reset mocks to clear any interference from previous describe blocks
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById.mockResolvedValue(mockGame);
      mockedDbUtils.select.mockResolvedValue([{ id: 'player-1' }, { id: 'player-2' }]);
    });

    it('should return game information successfully', async () => {
      const response = await request(app)
        .get(`/api/games/${gameCode}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: gameCode,
        name: 'Test Game',
        status: 'waiting',
        hostPlayerId: 'host-id',
        teamCount: 2,
        phrasesPerPlayer: 5,
        timerDuration: 60,
        currentRound: 1,
        currentTeam: 1,
        playerCount: 2,
        createdAt: '2023-01-01T00:00:00Z'
      });
    });

    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .get('/api/games/INVALID')
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    it('should return 404 for non-existent game', async () => {
      mockedDbUtils.findById.mockResolvedValue(undefined);

      const response = await request(app)
        .get(`/api/games/${gameCode}`)
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });

    it('should handle database errors gracefully', async () => {
      mockedDbUtils.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/games/${gameCode}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to get game information');
    });
  });
});

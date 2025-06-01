import request from 'supertest';
import { Application } from 'express';
import {
  setupTestApp,
  setupMockTransaction,
  resetAllMocks,
  mockedDbUtils,
  createMockGame
} from './test-utils';
import { UpdateConfigRequest } from '../../src/routes/REST-API';

describe('Game Configuration API', () => {
  let app: Application;
  let mockTransaction: any;

  beforeEach(() => {
    app = setupTestApp();
    mockTransaction = setupMockTransaction();
    resetAllMocks();
  });

  describe('PUT /api/games/:gameCode/config', () => {
    const gameCode = 'ABC123';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'waiting',
      host_player_id: 'host-id'
    });

    const validUpdateRequest: UpdateConfigRequest = {
      teamCount: 3,
      phrasesPerPlayer: 7,
      timerDuration: 90
    };

    beforeEach(() => {
      // Reset mocks to clear any interference from previous describe blocks
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();
      mockedDbUtils.insert.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Initial game lookup
        .mockResolvedValueOnce({ ...mockGame, team_count: 3, phrases_per_player: 7, timer_duration: 90 }); // Updated game
      mockedDbUtils.insert.mockResolvedValue('updated-id');
      mockedDbUtils.select.mockResolvedValue([{ id: 'player-1' }]);
    });

    it('should update game configuration successfully', async () => {
      const response = await request(app)
        .put(`/api/games/${gameCode}/config`)
        .send(validUpdateRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        teamCount: 3,
        phrasesPerPlayer: 7,
        timerDuration: 90
      });
    });

    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .put('/api/games/INVALID/config')
        .send(validUpdateRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    it('should return 404 for non-existent game', async () => {
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.findById.mockResolvedValue(undefined);

      const response = await request(app)
        .put(`/api/games/${gameCode}/config`)
        .send(validUpdateRequest)
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });

    it('should return 400 for game that has already started', async () => {
      const startedGame = { ...mockGame, status: 'playing' as const };
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.findById.mockResolvedValue(startedGame);

      const response = await request(app)
        .put(`/api/games/${gameCode}/config`)
        .send(validUpdateRequest)
        .expect(400);

      expect(response.body.error).toBe('Cannot update configuration after game has started');
    });

    it('should return 400 for invalid configuration values', async () => {
      const invalidRequest = {
        teamCount: 10 // Too many teams
      };

      const response = await request(app)
        .put(`/api/games/${gameCode}/config`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid configuration');
      expect(response.body.details).toContain('Team count must be an integer between 2 and 8');
    });
  });
});

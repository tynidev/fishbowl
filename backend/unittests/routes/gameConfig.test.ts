import request from 'supertest';
import {
  createGameScenario,
  expectInvalidGameCode,
  expectGameNotFound,
  expectGameAlreadyStarted,
  resetAllMocks
} from '../test-helpers';
import { UpdateConfigRequest } from '../../src/types/rest-api';
import { createRealDataStoreFromScenario } from '../realDbUtils';
import { app } from '../setupTests';

describe('Game Configuration API', () => {

  beforeEach(async () => {
    await resetAllMocks();
  });

  describe('PUT /api/games/:gameCode/config', () => {
    const gameCode = 'ABC123';
    const validUpdateRequest: UpdateConfigRequest = {
      teamCount: 3,
      phrasesPerPlayer: 7,
      timerDuration: 90
    };

    describe('Game Code Validation', () => {
      it('should return 400 for invalid game code format', async () => {
        const response = await request(app)
          .put('/api/games/INVALID/config')
          .send(validUpdateRequest);

        expectInvalidGameCode(response);
      });

      it('should return 404 for non-existent game', async () => {
        // Create empty scenario with no games to simulate non-existent game
        const scenario = createGameScenario({
          gameCode: 'DIFFERENT_CODE' // Different game code so it won't be found
        });
        await createRealDataStoreFromScenario(scenario).initDb();

        const response = await request(app)
          .put(`/api/games/${gameCode}/config`)
          .send(validUpdateRequest);

        expectGameNotFound(response);
      });

      it('should be case sensitive for game codes', async () => {
        // Create scenario with uppercase game code, test with lowercase
        const scenario = createGameScenario({
          gameCode: gameCode.toUpperCase(),
          gameStatus: 'waiting'
        });
        await createRealDataStoreFromScenario(scenario).initDb();

        const response = await request(app)
          .put('/api/games/abc123/config')
          .send(validUpdateRequest);

        expectGameNotFound(response);
      });
    });

    describe('Game State Validation', () => {
      it('should return 400 when game is in playing state', async () => {
        const scenario = createGameScenario({
          gameCode,
          gameStatus: 'playing'
        });
        await createRealDataStoreFromScenario(scenario).initDb();

        const response = await request(app)
          .put(`/api/games/${gameCode}/config`)
          .send(validUpdateRequest);

        expectGameAlreadyStarted(response);
      });

      it('should return 400 when game is in finished state', async () => {
        const scenario = createGameScenario({
          gameCode,
          gameStatus: 'finished'
        });
        await createRealDataStoreFromScenario(scenario).initDb();

        const response = await request(app)
          .put(`/api/games/${gameCode}/config`)
          .send(validUpdateRequest);

        expectGameAlreadyStarted(response);
      });
    });

    describe('Successful Configuration Updates', () => {
      let scenario: ReturnType<typeof createGameScenario>;

      beforeEach(async () => {
        scenario = createGameScenario({
          gameCode,
          gameStatus: 'waiting',
          playerCount: 1
        });
        await createRealDataStoreFromScenario(scenario).initDb();
      });

      it('should update game configuration successfully', async () => {
        const response = await request(app)
          .put(`/api/games/${gameCode}/config`)
          .send(validUpdateRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          phrasesPerPlayer: 7,
          teamCount: 3,
          timerDuration: 90
        });
      });
    });

    describe('Configuration Validation', () => {
      let scenario: ReturnType<typeof createGameScenario>;

      beforeEach(async () => {
        scenario = createGameScenario({
          gameCode,
          gameStatus: 'waiting'
        });
        await createRealDataStoreFromScenario(scenario).initDb();
      });

      it('should return 400 for invalid team count (too high)', async () => {
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

      it('should return 400 for invalid team count (too low)', async () => {
        const invalidRequest = {
          teamCount: 1
        };

        const response = await request(app)
          .put(`/api/games/${gameCode}/config`)
          .send(invalidRequest)
          .expect(400);

        expect(response.body.error).toBe('Invalid configuration');
        expect(response.body.details).toContain('Team count must be an integer between 2 and 8');
      });

      it('should return 400 for invalid phrases per player (too high)', async () => {
        const invalidRequest = {
          phrasesPerPlayer: 15
        };

        const response = await request(app)
          .put(`/api/games/${gameCode}/config`)
          .send(invalidRequest)
          .expect(400);

        expect(response.body.error).toBe('Invalid configuration');
      });

      it('should return 400 for invalid timer duration', async () => {
        const invalidRequest = {
          timerDuration: 10 // Too short
        };

        const response = await request(app)
          .put(`/api/games/${gameCode}/config`)
          .send(invalidRequest)
          .expect(400);

        expect(response.body.error).toBe('Invalid configuration');
      });
    });
  });
});

import request from 'supertest';
import { Application } from 'express';
import {
  setupTestApp,
  resetAllMocks,
  setupGameWithPlayers,
  setupMockTransaction,
  createGameScenario,
  expectGameAlreadyStarted,
  expectInvalidGameCode,
  expectPlayerNotInGame,
  createMockDataStoreFromScenario,
} from '../test-helpers';
import {
  SubmitPhrasesRequest,
  UpdatePhraseRequest
} from '../../src/types/rest-api';
import { phraseFactory, playerFactory } from '../test-factories';

describe('Phrases API', () => {
  let app: Application;

  beforeEach(() => {
    app = setupTestApp();
    setupMockTransaction();
    resetAllMocks();
  });

  describe('POST /api/games/:gameCode/phrases', () => {
    const gameCode = 'ABC123';

    describe('Game Code Validation', () => {
      it('should return 400 for invalid game code', async () => {
        const game = setupGameWithPlayers({ gameCode, gameStatus: 'phrase_submission' , playerCount: 2 , teamCount: 2 });

        const response = await request(app)
          .post('/api/games/INVALID/phrases')
          .send({ phrases: ['Test Phrase'], playerId: 'player-1' })
          .expect(400);

        expectInvalidGameCode(response);
      });
    });

    describe('Game State Validation', () => {
      it('should return 400 when game has started', async () => {
        const game = setupGameWithPlayers({ gameCode, gameStatus: 'playing' , playerCount: 2 , teamCount: 2 });

        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send({ phrases: ['Test Phrase'], playerId: 'player-1' })
          .expect(400);

        expectGameAlreadyStarted(response);
      });
    });

    describe('Valid phrase submission', () => {
      let scenario: ReturnType<typeof createGameScenario>;

      beforeEach(() => {
        scenario = setupGameWithPlayers({ gameCode, gameStatus: 'phrase_submission' , playerCount: 2 , teamCount: 2 });
      });

      it('should submit multiple phrases successfully', async () => {
        const request_data: SubmitPhrasesRequest = {
          phrases: ['Test Phrase 1', 'Test Phrase 2'],
          playerId: 'player-2'
        };

        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send(request_data)
          .expect(201);

        expect(response.body).toMatchObject({
          submittedCount: 2,
          totalRequired: 5,
          phrases: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              text: 'Test Phrase 1',
              submittedAt: expect.any(String)
            }),
            expect.objectContaining({
              id: expect.any(String),
              text: 'Test Phrase 2',
              submittedAt: expect.any(String)
            })
          ])
        });
      });

      it('should handle single phrase submission', async () => {
        const singlePhraseRequest = {
          phrases: 'Single Phrase',
          playerId: 'player-2'
        };

        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send(singlePhraseRequest)
          .expect(201);

        expect(response.body.submittedCount).toBe(1);
        expect(response.body.phrases).toHaveLength(1);
      });
    });

    describe('Validation errors', () => {
      it('should return 400 for missing player ID', async () => {
        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send({ phrases: ['Test Phrase'] })
          .expect(400);

        expect(response.body.error).toBe('Player ID is required');
      });

      it('should return 400 for empty phrases', async () => {
        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send({ phrases: [], playerId: 'player-1' })
          .expect(400);

        expect(response.body.error).toBe('Invalid phrases');
        expect(response.body.details).toContain('At least one phrase is required');
      });

      it('should return 400 when exceeding phrase limit', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' , playerCount: 2 , teamCount: 2, phrasesPerPlayer: 2 });

        const store = createMockDataStoreFromScenario(scenario)
          .addPhrase(phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Existing Phrase 1'))
          .addPhrase(phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Existing Phrase 2'))
          .setupMocks();
        
        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send({ phrases: [ 'Phrase 1' ], playerId: scenario.hostPlayer.id })
          .expect(400);

        expect(response.body.error).toContain('Cannot submit 1 phrases');
      });

      it('should return 400 for duplicate phrases', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' , playerCount: 2 , teamCount: 2, phrasesPerPlayer: 2 });

        const store = createMockDataStoreFromScenario(scenario)
          .addPhrase(phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Existing Phrase 1'))
          .setupMocks();

        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send({ phrases: ['Existing Phrase 1'], playerId: scenario.hostPlayer.id })
          .expect(400);

        expect(response.body.error).toBe('Duplicate phrases detected');
        expect(response.body.details[0]).toContain('Existing Phrase 1');
      });

      it('should return 400 for player not in game', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' , playerCount: 2 , teamCount: 2, phrasesPerPlayer: 2 });
        const wrongPlayer = playerFactory.connected('other-game', 'team-1', 'Wrong Player');

        const store = createMockDataStoreFromScenario(scenario)
          .addPlayer(wrongPlayer)
          .addPhrase(phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Existing Phrase 1'))
          .setupMocks();

        const response = await request(app)
          .post(`/api/games/${gameCode}/phrases`)
          .send({ phrases: ['Test Phrase'], playerId: 'wrong-player' })
          .expect(400);

        expectPlayerNotInGame(response);
      });
    });
  });

  describe('GET /api/games/:gameCode/phrases', () => {
    const gameCode = 'ABC123';

    describe('Game Code Validation', () => {
      it('should return 400 for invalid game code', async () => {
        const response = await request(app)
          .get('/api/games/INVALID/phrases?playerId=player-1')
          .expect(400);

        expectInvalidGameCode(response);
      });
    });

    describe('Host authorization', () => {
      it('should return phrases for host player', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' , playerCount: 2 , teamCount: 2, phrasesPerPlayer: 2 });

        const store = createMockDataStoreFromScenario(scenario)
          .addPhrase(phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Test Phrase 1'))
          .addPhrase(phraseFactory.create(gameCode, scenario.players[1]?.id as string, 'Test Phrase 2'))
          .setupMocks();

        const response = await request(app)
          .get(`/api/games/${gameCode}/phrases?playerId=${scenario.hostPlayer.id}`)
          .expect(200);

        expect(response.body).toMatchObject({
          phrases: expect.arrayContaining([
            expect.objectContaining({
              text: 'Test Phrase 1'
            })
          ]),
          totalCount: 2, // Two phrases returned based on our mock
          gameInfo: {
            phrasesPerPlayer: 2,
            totalPlayers: 2,
            totalExpected: 4
          }
        });
      });

      it('should return 403 for non-host player', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' , playerCount: 2 , teamCount: 2, phrasesPerPlayer: 2 });

        const store = createMockDataStoreFromScenario(scenario)
          .addPhrase(phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Test Phrase 1'))
          .addPhrase(phraseFactory.create(gameCode, scenario.players[1]?.id as string, 'Test Phrase 2'))
          .setupMocks();

        const response = await request(app)
          .get(`/api/games/${gameCode}/phrases?playerId=${scenario.players[1]!.id}`)
          .expect(403);

        expect(response.body.error).toBe('Only the game host can view all phrases');
      });

      it('should return 400 for missing player ID', async () => {
        const scenario = createGameScenario({ gameCode });
        createMockDataStoreFromScenario(scenario).setupMocks();

        const response = await request(app)
          .get(`/api/games/${gameCode}/phrases`)
          .expect(400);

        expect(response.body.error).toBe('Player ID is required for authorization');
      });
    });
  });

  describe('GET /api/games/:gameCode/phrases/status', () => {
    const gameCode = 'ABC123';

    describe('Game Code Validation', () => {
      it('should return 400 for invalid game code', async () => {
        const response = await request(app)
          .get('/api/games/INVALID/phrases/status')
          .expect(400);

        expectInvalidGameCode(response);
      });
    });

    it('should return phrase submission status for all players', async () => {
      const scenario = createGameScenario({
        gameCode,
        gameStatus: 'phrase_submission',
        playerCount: 2
      });        
      
      const store = createMockDataStoreFromScenario(scenario)
          .addPhrase(phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Phrase 1'))
          .addPhrase(phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Phrase 2'))
          .setupMocks();

      const response = await request(app)
        .get(`/api/games/${gameCode}/phrases/status`)
        .expect(200);

      expect(response.body.summary).toMatchObject({
        totalPlayers: 2,
        playersComplete: 0,
        totalPhrasesSubmitted: 2,
        totalPhrasesRequired: 10,
        isAllComplete: false
      });

      // Check that we have the right number of players
      expect(response.body.players).toHaveLength(2);
      
      // Find the player with 2 phrases submitted
      const playerWithPhrases = response.body.players.find((p: any) => p.submitted === 2);
      const playerWithoutPhrases = response.body.players.find((p: any) => p.submitted === 0);
      
      expect(playerWithPhrases).toBeDefined();
      expect(playerWithoutPhrases).toBeDefined();
      expect(playerWithPhrases.required).toBe(5);
      expect(playerWithoutPhrases.required).toBe(5);
    });
  });

  describe('PUT /api/games/:gameCode/phrases/:phraseId', () => {
    const gameCode = 'ABC123';
    const phraseId = 'phrase-1';

    describe('Game State Validation', () => {
      it('should return 400 when game has started', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'playing' });
        createMockDataStoreFromScenario(scenario).setupMocks();

        const response = await request(app)
          .put(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
          .send({ text: 'Updated text' })
          .expect(400);

        expectGameAlreadyStarted(response);
      });
    });

    describe('Valid phrase updates', () => {
      it('should update phrase successfully', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
      
        const phrase = phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Phrase 1');
        const store = createMockDataStoreFromScenario(scenario)
          .addPhrase(phrase)
          .setupMocks();

        const updateRequest: UpdatePhraseRequest = { text: 'Updated Phrase Text' };

        const response = await request(app)
          .put(`/api/games/${gameCode}/phrases/${phrase.id}?playerId=${scenario.hostPlayer.id}`)
          .send(updateRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          id: phrase.id,
          text: 'Updated Phrase Text',
          updatedAt: expect.any(String)
        });
      });

      it('should return 403 when player tries to edit another player\'s phrase', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[2]?.id as string, 'Phrase 2');

        const store = createMockDataStoreFromScenario(scenario)
            .addPhrase(p1Phrase)
            .addPhrase(p2Phrase)
            .setupMocks();

        const response = await request(app)
          .put(`/api/games/${gameCode}/phrases/${p1Phrase.id}?playerId=${p2Phrase.player_id}`)
          .send({ text: 'Updated Text' })
          .expect(403);

        expect(response.body.error).toBe('You can only edit your own phrases');
      });

      it('should return 400 for duplicate phrase text', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[2]?.id as string, 'Phrase 2');

        const store = createMockDataStoreFromScenario(scenario)
            .addPhrase(p1Phrase)
            .addPhrase(p2Phrase)
            .setupMocks();

        const response = await request(app)
          .put(`/api/games/${gameCode}/phrases/${p1Phrase.id}?playerId=${p1Phrase.player_id}`)
          .send({ text: 'Phrase 2' })
          .expect(400);

        expect(response.body.error).toBe('This phrase already exists in the game');
      });
    });
  });

  describe('DELETE /api/games/:gameCode/phrases/:phraseId', () => {
    const gameCode = 'ABC123';
    const phraseId = 'phrase-1';

    describe('Game State Validation', () => {
      it('should return 400 when game has started', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'playing' });
        createMockDataStoreFromScenario(scenario).setupMocks();

        const response = await request(app)
          .delete(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
          .expect(400);

        expectGameAlreadyStarted(response);
      });
    });

    describe('Valid phrase deletion', () => {
      let scenario: ReturnType<typeof createGameScenario>;

      beforeEach(() => {
        scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
      });

      it('should delete phrase successfully when player owns it', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[2]?.id as string, 'Phrase 2');

        const store = createMockDataStoreFromScenario(scenario)
            .addPhrase(p1Phrase)
            .addPhrase(p2Phrase)
            .setupMocks();

        const response = await request(app)
          .delete(`/api/games/${gameCode}/phrases/${p1Phrase.id}?playerId=${p1Phrase.player_id}`)
          .expect(200);
      });

      it('should delete phrase successfully when host deletes it', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
        
        const playerId = scenario.hostPlayer.id === scenario.players[0]?.id ? scenario.players[1]?.id : scenario.players[0]?.id;
        const p1Phrase = phraseFactory.create(gameCode, playerId as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.hostPlayer.id as string, 'Phrase 2');

        const store = createMockDataStoreFromScenario(scenario)
            .addPhrase(p1Phrase)
            .addPhrase(p2Phrase)
            .setupMocks();

        const response = await request(app)
          .delete(`/api/games/${gameCode}/phrases/${p1Phrase.id}?playerId=${scenario.hostPlayer.id}`)
          .expect(200);

        expect(response.body.message).toBe('Phrase deleted successfully');
      });

      it('should return 403 when non-owner, non-host tries to delete', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[2]?.id as string, 'Phrase 2');

        const store = createMockDataStoreFromScenario(scenario)
            .addPhrase(p1Phrase)
            .addPhrase(p2Phrase)
            .setupMocks();

        const response = await request(app)
          .delete(`/api/games/${gameCode}/phrases/${p1Phrase.id}?playerId=${p2Phrase.player_id}`)
          .expect(403);

        expect(response.body.error).toBe('You can only delete your own phrases, or phrases as the game host');
      });

      it('should return 404 for non-existent phrase', async () => {
        const scenario = createGameScenario({ gameCode, gameStatus: 'phrase_submission' });
      
        const store = createMockDataStoreFromScenario(scenario)
            .setupMocks();

        const response = await request(app)
          .delete(`/api/games/${gameCode}/phrases/${phraseId}?playerId=${scenario.players[0]?.id}`)
          .expect(404);

        expect(response.body.error).toBe('Phrase not found');
      });
    });
  });
});

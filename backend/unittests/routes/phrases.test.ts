import {
  createGameScenario,
  expectGameAlreadyStarted,
  expectInvalidGameCode,
  expectPlayerNotInGame,
  resetAllMocks,
} from '../test-helpers/test-helpers';
import {
  SubmitPhrasesRequest,
  UpdatePhraseRequest
} from '../../src/types/rest-api';
import { phraseFactory, playerFactory } from '../test-helpers/test-factories';
import { createRealDataStoreFromScenario } from '../test-helpers/realDbUtils';
import { createPhraseApi, PhraseApiHelper } from '../test-helpers/phrase-api-helper';
import { setupGameWithPhrases } from '../test-helpers/phrase-test-helpers';

describe('Phrases API', () => {
  let api: PhraseApiHelper;
  const gameCode = 'ABC123';

  beforeEach(async () => {
    await resetAllMocks();
    api = createPhraseApi(gameCode);
  });

  describe('POST /api/games/:gameCode/phrases', () => {
    describe('Game Code Validation', () => {      it('should return 400 for invalid game code', async () => {
        await setupGameWithPhrases({ gameCode });
          
        const response = await api
          .submitPhrasesInvalidGameCode(['Test Phrase'], 'player-1')
          .expect(400);

        expectInvalidGameCode(response);
      });
    });

    describe('Game State Validation', () => {
      it('should return 400 when game has started', async () => {
        await setupGameWithPhrases({
          gameCode,
          gameStatus: 'playing'
        });

        const response = await api
          .submitPhrases('player-1', ['Test Phrase'])
          .expect(400);

        expectGameAlreadyStarted(response);
      });
    });

    describe('Valid phrase submission', () => {
      let scenario: ReturnType<typeof createGameScenario>;

      beforeEach(async () => {
        const setup = await setupGameWithPhrases({ gameCode });
        scenario = setup.scenario;
      });

      it('should submit multiple phrases successfully', async () => {
        const response = await api
          .submitPhrases('player-2', ['Test Phrase 1', 'Test Phrase 2'])
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
        const response = await api
          .submitPhrases('player-2', 'Single Phrase')
          .expect(201);

        expect(response.body.submittedCount).toBe(1);
        expect(response.body.phrases).toHaveLength(1);
      });
    });

    describe('Validation errors', () => {
      it('should return 400 for missing player ID', async () => {
        const response = await api
          .submitPhrasesInvalid(['Test Phrase'])
          .expect(400);

        expect(response.body.error).toBe('Player ID is required');
      });

      it('should return 400 for empty phrases', async () => {
        const response = await api
          .submitPhrases('player-1', [])
          .expect(400);

        expect(response.body.error).toBe('Invalid phrases');
        expect(response.body.details).toContain('At least one phrase is required');
      });

      it('should return 400 when exceeding phrase limit', async () => {
        const { scenario } = await setupGameWithPhrases({
          gameCode,
          phrasesPerPlayer: 2,
          phrases: [
            { playerId: 'host-player-id', text: 'Existing Phrase 1' },
            { playerId: 'host-player-id', text: 'Existing Phrase 2' }
          ]
        });
        
        const response = await api
          .submitPhrases(scenario.hostPlayer.id, ['Phrase 1'])
          .expect(400);

        expect(response.body.error).toContain('Cannot submit 1 phrases');
      });

      it('should return 400 for duplicate phrases', async () => {
        const { scenario } = await setupGameWithPhrases({
          gameCode,
          phrasesPerPlayer: 2,
          phrases: [
            { playerId: 'host-player-id', text: 'Existing Phrase 1' }
          ]
        });

        const response = await api
          .submitPhrases(scenario.hostPlayer.id, ['Existing Phrase 1'])
          .expect(400);

        expect(response.body.error).toBe('Duplicate phrases detected');
        expect(response.body.details[0]).toContain('Existing Phrase 1');
      });

      it('should return 400 for player not in game', async () => {
        const { scenario, store } = await setupGameWithPhrases({
          gameCode,
          phrasesPerPlayer: 2,
          phrases: [
            { playerId: 'host-player-id', text: 'Existing Phrase 1' }
          ]
        });

        const wrongPlayer = playerFactory.connected('other-game', 'team-1', 'Wrong Player');
        await store.addPlayer(wrongPlayer);

        const response = await api
          .submitPhrases('wrong-player', ['Test Phrase'])
          .expect(400);

        expectPlayerNotInGame(response);
      });
    });
  });

  describe('GET /api/games/:gameCode/phrases', () => {
    describe('Game Code Validation', () => {
      it('should return 400 for invalid game code', async () => {
        const response = await api
          .getPhrasesInvalid('player-1')
          .expect(400);

        expectInvalidGameCode(response);
      });
    });

    describe('Host authorization', () => {
      it('should return phrases for host player', async () => {
        const { scenario, store } = await setupGameWithPhrases({
          gameCode,
          phrasesPerPlayer: 2,
          phrases: [
            { playerId: 'player-1-id', text: 'Test Phrase 1' },
            { playerId: 'player-2-id', text: 'Test Phrase 2' }
          ]
        });

        const response = await api
          .getPhrases(scenario.hostPlayer.id)
          .expect(200);

        expect(response.body).toMatchObject({
          phrases: expect.arrayContaining([
            expect.objectContaining({
              text: 'Test Phrase 1'
            })
          ]),
          totalCount: 2,
          gameInfo: {
            phrasesPerPlayer: 2,
            totalPlayers: 2,
            totalExpected: 4
          }
        });
      });

      it('should return 403 for non-host player', async () => {
        const { scenario, store } = await setupGameWithPhrases({
          gameCode,
          phrasesPerPlayer: 2,
          phrases: [
            { playerId: 'player-1-id', text: 'Test Phrase 1' },
            { playerId: 'player-2-id', text: 'Test Phrase 2' }
          ]
        });

        const nonHostPlayer = scenario.players.find(p => p.id !== scenario.hostPlayer.id);

        const response = await api
          .getPhrases(nonHostPlayer!.id)
          .expect(403);

        expect(response.body.error).toBe('Only the game host can view all phrases');
      });

      it('should return 400 for missing player ID', async () => {
        await setupGameWithPhrases({ gameCode });

        const response = await api
          .getPhrasesWithoutPlayerId()
          .expect(400);

        expect(response.body.error).toBe('Player ID is required for authorization');
      });
    });
  });

  describe('GET /api/games/:gameCode/phrases/status', () => {
    describe('Game Code Validation', () => {
      it('should return 400 for invalid game code', async () => {
        const response = await api
          .getPhrasesStatusInvalid()
          .expect(400);

        expectInvalidGameCode(response);
      });
    });

    it('should return phrase submission status for all players', async () => {
      const { scenario } = await setupGameWithPhrases({
        gameCode,
        phrases: [
          { playerId: 'host-player-id', text: 'Phrase 1' },
          { playerId: 'host-player-id', text: 'Phrase 2' }
        ]
      });

      const response = await api
        .getPhrasesStatus()
        .expect(200);

      expect(response.body.summary).toMatchObject({
        totalPlayers: 2,
        playersComplete: 0,
        totalPhrasesSubmitted: 2,
        totalPhrasesRequired: 10,
        isAllComplete: false
      });

      expect(response.body.players).toHaveLength(2);
      
      const playerWithPhrases = response.body.players.find((p: any) => p.submitted === 2);
      const playerWithoutPhrases = response.body.players.find((p: any) => p.submitted === 0);
      
      expect(playerWithPhrases).toBeDefined();
      expect(playerWithoutPhrases).toBeDefined();
      expect(playerWithPhrases.required).toBe(5);
      expect(playerWithoutPhrases.required).toBe(5);
    });
  });

  describe('PUT /api/games/:gameCode/phrases/:phraseId', () => {
    describe('Game State Validation', () => {
      it('should return 400 when game has started', async () => {
        await setupGameWithPhrases({ 
          gameCode, 
          gameStatus: 'playing' 
        });

        const response = await api
          .updatePhrase('phrase-1', 'player-1', 'Updated text')
          .expect(400);

        expectGameAlreadyStarted(response);
      });
    });

    describe('Valid phrase updates', () => {
      it('should update phrase successfully', async () => {
        const { scenario, store } = await setupGameWithPhrases({ 
          gameCode 
        });
      
        const phrase = phraseFactory.create(gameCode, scenario.hostPlayer.id, 'Phrase 1');
        await store.addPhrase(phrase);

        const response = await api
          .updatePhrase(phrase.id, scenario.hostPlayer.id, 'Updated Phrase Text')
          .expect(200);

        expect(response.body).toMatchObject({
          submittedCount: 1,
          totalRequired: 5,
          phrases: expect.arrayContaining([
            expect.objectContaining({
              id: phrase.id,
              text: 'Updated Phrase Text',
              submittedAt: expect.any(String)
            })
          ])
        });
      });      it('should return 403 when player tries to edit another player\'s phrase', async () => {
        const { scenario, store } = await setupGameWithPhrases({ 
          gameCode 
        });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[1]?.id as string, 'Phrase 2');

        await store.addPhrase(p1Phrase);
        await store.addPhrase(p2Phrase);

        const response = await api
          .updatePhrase(p1Phrase.id, p2Phrase.player_id, 'Updated Text')
          .expect(403);

        expect(response.body.error).toBe('You can only edit your own phrases');
      });      it('should return 400 for duplicate phrase text', async () => {
        const { scenario, store } = await setupGameWithPhrases({ 
          gameCode 
        });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[1]?.id as string, 'Phrase 2');

        await store.addPhrase(p1Phrase);
        await store.addPhrase(p2Phrase);

        const response = await api
          .updatePhrase(p1Phrase.id, p1Phrase.player_id, 'Phrase 2')
          .expect(400);

        expect(response.body.error).toBe('This phrase already exists in the game');
      });
    });
  });

  describe('DELETE /api/games/:gameCode/phrases/:phraseId', () => {
    describe('Game State Validation', () => {
      it('should return 400 when game has started', async () => {
        await setupGameWithPhrases({ 
          gameCode, 
          gameStatus: 'playing' 
        });

        const response = await api
          .deletePhrase('phrase-1', 'player-1')
          .expect(400);

        expectGameAlreadyStarted(response);
      });
    });

    describe('Valid phrase deletion', () => {      it('should delete phrase successfully when player owns it', async () => {
        const { scenario, store } = await setupGameWithPhrases({ 
          gameCode 
        });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[1]?.id as string, 'Phrase 2');

        await store.addPhrase(p1Phrase);
        await store.addPhrase(p2Phrase);

        await api
          .deletePhrase(p1Phrase.id, p1Phrase.player_id)
          .expect(200);
      });

      it('should delete phrase successfully when host deletes it', async () => {
        const { scenario, store } = await setupGameWithPhrases({ 
          gameCode 
        });
        
        const playerId = scenario.hostPlayer.id === scenario.players[0]?.id ? scenario.players[1]?.id : scenario.players[0]?.id;
        const p1Phrase = phraseFactory.create(gameCode, playerId as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.hostPlayer.id as string, 'Phrase 2');

        await store.addPhrase(p1Phrase);
        await store.addPhrase(p2Phrase);

        const response = await api
          .deletePhrase(p1Phrase.id, scenario.hostPlayer.id)
          .expect(200);

        expect(response.body.message).toBe('Phrase deleted successfully');
      });      it('should return 403 when non-owner, non-host tries to delete', async () => {
        const { scenario, store } = await setupGameWithPhrases({ 
          gameCode 
        });
      
        const p1Phrase = phraseFactory.create(gameCode, scenario.players[0]?.id as string, 'Phrase 1');
        const p2Phrase = phraseFactory.create(gameCode, scenario.players[1]?.id as string, 'Phrase 2');

        await store.addPhrase(p1Phrase);
        await store.addPhrase(p2Phrase);

        const response = await api
          .deletePhrase(p1Phrase.id, p2Phrase.player_id)
          .expect(403);

        expect(response.body.error).toBe('You can only delete your own phrases, or phrases as the game host');
      });

      it('should return 404 for non-existent phrase', async () => {
        const { scenario } = await setupGameWithPhrases({ 
          gameCode 
        });

        const response = await api
          .deletePhrase('phrase-1', scenario.players[0]?.id as string)
          .expect(404);

        expect(response.body.error).toBe('Phrase not found');
      });
    });
  });
});

import request from 'supertest';
import { Application } from 'express';
import {
  setupTestApp,
  setupMockTransaction,
  resetAllMocks,
  mockedDbUtils,
  createMockGame,
  createMockPlayer,
  createMockPhrase
} from './test-utils';
import {
  SubmitPhrasesRequest,
  UpdatePhraseRequest
} from '../../src/types/rest-api';
import { Player, Phrase } from '../../src/db/schema';

describe('Phrases API', () => {
  let app: Application;
  let mockTransaction: any;

  beforeEach(() => {
    app = setupTestApp();
    mockTransaction = setupMockTransaction();
    resetAllMocks();
  });

  describe('POST /api/games/:gameCode/phrases', () => {
    const gameCode = 'ABC123';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'phrase_submission',
      host_player_id: 'host-id'
    });

    const mockPlayer = createMockPlayer({
      id: 'player-1',
      game_id: gameCode,
      name: 'Test Player',
      team_id: 'team-1',
      is_connected: true
    });

    const validSubmitRequest: SubmitPhrasesRequest = {
      phrases: ['Test Phrase 1', 'Test Phrase 2'],
      playerId: 'player-1'
    };

    beforeEach(() => {
      // Reset mocks to clear any interference from previous describe blocks
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();
      mockedDbUtils.insert.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Game lookup
        .mockResolvedValueOnce(mockPlayer); // Player lookup
      mockedDbUtils.select
        .mockResolvedValueOnce([]) // Existing player phrases
        .mockResolvedValueOnce([]); // All game phrases for duplicate check
      mockedDbUtils.insert.mockResolvedValue('phrase-id');
    });

    it('should submit phrases successfully', async () => {
      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(validSubmitRequest)
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
        playerId: 'player-1'
      };

      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(singlePhraseRequest)
        .expect(201);

      expect(response.body.submittedCount).toBe(1);
      expect(response.body.phrases).toHaveLength(1);
    });

    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .post('/api/games/INVALID/phrases')
        .send(validSubmitRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    it('should return 400 for missing player ID', async () => {
      const invalidRequest = {
        phrases: ['Test Phrase']
      };

      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Player ID is required');
    });

    it('should return 400 for empty phrases', async () => {
      const invalidRequest = {
        phrases: [],
        playerId: 'player-1'
      };

      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid phrases');
      expect(response.body.details).toContain('At least one phrase is required');
    });

    it('should return 400 when exceeding phrase limit', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Game lookup
        .mockResolvedValueOnce(mockPlayer); // Player lookup

      // Mock existing phrases that would cause limit exceeded
      mockedDbUtils.select
        .mockResolvedValueOnce([
          { id: '1', text: 'existing1' },
          { id: '2', text: 'existing2' },
          { id: '3', text: 'existing3' },
          { id: '4', text: 'existing4' }
        ]) // 4 existing phrases
        .mockResolvedValueOnce([]); // All game phrases

      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(validSubmitRequest) // Trying to add 2 more (would be 6 total, limit is 5)
        .expect(400);

      expect(response.body.error).toContain('Cannot submit 2 phrases');
    });

    it('should return 400 for duplicate phrases', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Game lookup
        .mockResolvedValueOnce(mockPlayer); // Player lookup

      const existingPhrases: Phrase[] = [{
        id: 'existing-1',
        game_id: gameCode,
        player_id: 'other-player',
        text: 'Test Phrase 1',
        status: 'active',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }];

      mockedDbUtils.select
        .mockResolvedValueOnce([]) // No existing player phrases
        .mockResolvedValueOnce(existingPhrases); // Game has duplicate phrase

      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(validSubmitRequest)
        .expect(400);

      expect(response.body.error).toBe('Duplicate phrases detected');
      expect(response.body.details[0]).toContain('Test Phrase 1');
    });

    it('should return 400 when game has started', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();

      const startedGame = { ...mockGame, status: 'playing' as const };
      mockedDbUtils.findById.mockResolvedValueOnce(startedGame);

      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(validSubmitRequest)
        .expect(400);

      expect(response.body.error).toBe('Cannot submit phrases after game has started');
    });

    it('should return 400 for player not in game', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();

      const wrongPlayer = { ...mockPlayer, game_id: 'other-game' };
      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(wrongPlayer);

      const response = await request(app)
        .post(`/api/games/${gameCode}/phrases`)
        .send(validSubmitRequest)
        .expect(400);

      expect(response.body.error).toBe('Player not found in this game');
    });
  });

  describe('GET /api/games/:gameCode/phrases', () => {
    const gameCode = 'ABC123';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'phrase_submission',
      host_player_id: 'host-id'
    });

    const mockHostPlayer = createMockPlayer({
      id: 'host-id',
      game_id: gameCode,
      name: 'Host Player',
      team_id: 'team-1',
      is_connected: true
    });

    const mockPhrases: Phrase[] = [
      createMockPhrase({
        id: 'phrase-1',
        game_id: gameCode,
        player_id: 'player-1',
        text: 'Test Phrase 1'
      }),
      createMockPhrase({
        id: 'phrase-2',
        game_id: gameCode,
        player_id: 'player-2',
        text: 'Test Phrase 2'
      })
    ];

    beforeEach(() => {
      // Reset mocks to clear any interference from previous describe blocks
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Game lookup
        .mockResolvedValueOnce(mockHostPlayer); // Player lookup
      mockedDbUtils.select
        .mockResolvedValueOnce(mockPhrases) // Phrases
        .mockResolvedValueOnce([
          { id: 'player-1', name: 'Player 1' },
          { id: 'player-2', name: 'Player 2' }
        ]); // Players for name mapping
    });

    it('should return phrases for host player', async () => {
      const response = await request(app)
        .get(`/api/games/${gameCode}/phrases?playerId=host-id`)
        .expect(200);

      expect(response.body).toMatchObject({
        phrases: expect.arrayContaining([
          expect.objectContaining({
            id: 'phrase-1',
            text: 'Test Phrase 1',
            playerId: 'player-1',
            playerName: 'Player 1'
          }),
          expect.objectContaining({
            id: 'phrase-2',
            text: 'Test Phrase 2',
            playerId: 'player-2',
            playerName: 'Player 2'
          })
        ]),
        totalCount: 2,
        gameInfo: {
          phrasesPerPlayer: 5,
          totalPlayers: 2,
          totalExpected: 10
        }
      });
    });

    it('should return 403 for non-host player', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      const nonHostPlayer = { ...mockHostPlayer, id: 'other-player' };
      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(nonHostPlayer);

      const response = await request(app)
        .get(`/api/games/${gameCode}/phrases?playerId=other-player`)
        .expect(403);

      expect(response.body.error).toBe('Only the game host can view all phrases');
    });

    it('should return 400 for missing player ID', async () => {
      const response = await request(app)
        .get(`/api/games/${gameCode}/phrases`)
        .expect(400);

      expect(response.body.error).toBe('Player ID is required for authorization');
    });
  });

  describe('GET /api/games/:gameCode/phrases/status', () => {
    const gameCode = 'ABC123';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'phrase_submission',
      host_player_id: 'host-id'
    });

    const mockPlayers: Player[] = [
      createMockPlayer({
        id: 'player-1',
        game_id: gameCode,
        name: 'Player 1',
        team_id: 'team-1'
      }),
      createMockPlayer({
        id: 'player-2',
        game_id: gameCode,
        name: 'Player 2',
        team_id: 'team-2'
      })
    ];

    const mockPhrases: Phrase[] = [
      createMockPhrase({
        id: 'phrase-1',
        game_id: gameCode,
        player_id: 'player-1',
        text: 'Phrase 1'
      }),
      createMockPhrase({
        id: 'phrase-2',
        game_id: gameCode,
        player_id: 'player-1',
        text: 'Phrase 2'
      })
      // Player 2 has no phrases yet
    ];

    beforeEach(() => {
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById.mockResolvedValue(mockGame);
      mockedDbUtils.select
        .mockResolvedValueOnce(mockPlayers) // Players
        .mockResolvedValueOnce(mockPhrases); // Phrases
    });

    it('should return phrase submission status for all players', async () => {
      const response = await request(app)
        .get(`/api/games/${gameCode}/phrases/status`)
        .expect(200);

      expect(response.body).toMatchObject({
        players: [
          {
            playerId: 'player-1',
            playerName: 'Player 1',
            submitted: 2,
            required: 5,
            isComplete: false
          },
          {
            playerId: 'player-2',
            playerName: 'Player 2',
            submitted: 0,
            required: 5,
            isComplete: false
          }
        ],
        summary: {
          totalPlayers: 2,
          playersComplete: 0,
          totalPhrasesSubmitted: 2,
          totalPhrasesRequired: 10,
          isAllComplete: false
        }
      });
    });
  });

  describe('PUT /api/games/:gameCode/phrases/:phraseId', () => {
    const gameCode = 'ABC123';
    const phraseId = 'phrase-1';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'phrase_submission',
      host_player_id: 'host-id'
    });

    const mockPhrase = createMockPhrase({
      id: phraseId,
      game_id: gameCode,
      player_id: 'player-1',
      text: 'Old Phrase Text'
    });

    const validUpdateRequest: UpdatePhraseRequest = {
      text: 'Updated Phrase Text'
    };

    beforeEach(() => {
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();
      mockedDbUtils.insert.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Game lookup
        .mockResolvedValueOnce(mockPhrase); // Phrase lookup
      mockedDbUtils.select.mockResolvedValue([]); // No conflicting phrases
      mockedDbUtils.insert.mockResolvedValue('updated-phrase-id');
    });

    it('should update phrase successfully', async () => {
      const response = await request(app)
        .put(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
        .send(validUpdateRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        id: phraseId,
        text: 'Updated Phrase Text',
        updatedAt: expect.any(String)
      });
    });

    it('should return 403 when player tries to edit another player\'s phrase', async () => {
      const response = await request(app)
        .put(`/api/games/${gameCode}/phrases/${phraseId}?playerId=other-player`)
        .send(validUpdateRequest)
        .expect(403);

      expect(response.body.error).toBe('You can only edit your own phrases');
    });

    it('should return 400 for duplicate phrase text', async () => {
      const conflictingPhrase = {
        id: 'other-phrase',
        text: 'Updated Phrase Text',
        game_id: gameCode
      };

      mockedDbUtils.select.mockResolvedValue([conflictingPhrase]);

      const response = await request(app)
        .put(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
        .send(validUpdateRequest)
        .expect(400);

      expect(response.body.error).toBe('This phrase already exists in the game');
    });

    it('should return 400 when game has started', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();

      const startedGame = { ...mockGame, status: 'playing' as const };
      mockedDbUtils.findById.mockResolvedValueOnce(startedGame);

      const response = await request(app)
        .put(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
        .send(validUpdateRequest)
        .expect(400);

      expect(response.body.error).toBe('Cannot edit phrases after game has started');
    });
  });

  describe('DELETE /api/games/:gameCode/phrases/:phraseId', () => {
    const gameCode = 'ABC123';
    const phraseId = 'phrase-1';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'phrase_submission',
      host_player_id: 'host-id'
    });

    const mockPhrase = createMockPhrase({
      id: phraseId,
      game_id: gameCode,
      player_id: 'player-1',
      text: 'Test Phrase'
    });

    const mockPlayer = createMockPlayer({
      id: 'player-1',
      game_id: gameCode,
      name: 'Test Player',
      team_id: 'team-1'
    });

    beforeEach(() => {
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame) // Game lookup
        .mockResolvedValueOnce(mockPhrase) // Phrase lookup
        .mockResolvedValueOnce(mockPlayer); // Player lookup
      mockTransaction.run.mockResolvedValue({});
    });

    it('should delete phrase successfully when player owns it', async () => {
      const response = await request(app)
        .delete(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
        .expect(200);

      expect(response.body.message).toBe('Phrase deleted successfully');
      expect(mockTransaction.run).toHaveBeenCalledWith('DELETE FROM phrases WHERE id = ?', [phraseId]);
    });

    it('should delete phrase successfully when host deletes it', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();

      const hostPlayer = { ...mockPlayer, id: 'host-id' };
      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(mockPhrase)
        .mockResolvedValueOnce(hostPlayer);

      const response = await request(app)
        .delete(`/api/games/${gameCode}/phrases/${phraseId}?playerId=host-id`)
        .expect(200);

      expect(response.body.message).toBe('Phrase deleted successfully');
    });

    it('should return 403 when non-owner, non-host tries to delete', async () => {
      const otherPlayer = { ...mockPlayer, id: 'other-player' };
      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(mockPhrase)
        .mockResolvedValueOnce(otherPlayer);

      const response = await request(app)
        .delete(`/api/games/${gameCode}/phrases/${phraseId}?playerId=other-player`)
        .expect(403);

      expect(response.body.error).toBe('You can only delete your own phrases, or phrases as the game host');
    });

    it('should return 400 when game has started', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();

      const startedGame = { ...mockGame, status: 'playing' as const };
      mockedDbUtils.findById.mockResolvedValueOnce(startedGame);

      const response = await request(app)
        .delete(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
        .expect(400);

      expect(response.body.error).toBe('Cannot delete phrases after game has started');
    });

    it('should return 404 for non-existent phrase', async () => {
      // Reset mocks to override beforeEach setup
      mockedDbUtils.findById.mockReset();

      mockedDbUtils.findById
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(undefined); // Phrase not found

      const response = await request(app)
        .delete(`/api/games/${gameCode}/phrases/${phraseId}?playerId=player-1`)
        .expect(404);

      expect(response.body.error).toBe('Phrase not found');
    });
  });
});

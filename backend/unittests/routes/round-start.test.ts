import request from 'supertest';
import { createGameScenario, resetAllMocks } from '../test-helpers/test-helpers';
import { setSocketServer } from '../../src/controllers/gamesController';
import { broadcastRoundStarted } from '../../src/sockets/SOCKET-API';
import { gameFactory, playerFactory, teamFactory, phraseFactory } from '../test-helpers/test-factories';
import { Game, Phrase, Player, Team, Turn, TurnOrder } from '../../src/db/schema';
import { insert, select, findById } from '../../src/db/utils';
import { withTransaction } from '../../src/db/connection';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../setupTests';
import { createRealDataStoreFromScenario } from '../test-helpers/realDbUtils';

// Mock Socket.IO server
const mockSocketServer = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// Mock broadcastRoundStarted function
jest.mock('../../src/sockets/SOCKET-API', () => ({
  ...jest.requireActual('../../src/sockets/SOCKET-API'),
  broadcastRoundStarted: jest.fn(),
}));

describe('POST /api/games/:gameCode/rounds/start', () => {
  const gameCode = 'ABC123';

  beforeEach(async () => {
    await resetAllMocks();
    
    // Set the mock socket server
    setSocketServer(mockSocketServer as any);
    
    // Reset mocks
    (broadcastRoundStarted as jest.Mock).mockClear();
  });

  // Setup a game in round_intro status
  async function setupGameInRoundIntro() {
      const scenario = createGameScenario({
        gameCode,
        gameStatus: 'setup',
        gameSubStatus: 'waiting_for_players',
        teamCount: 2,
        playerCount: 4, // 2 players per team
        phrasesPerPlayer: 5
      });

      const dataStore = createRealDataStoreFromScenario(scenario);
      await dataStore.initDb();

      // Add required phrases for each player
      for (const player of scenario.players) {
        for (let i = 0; i < scenario.game.phrases_per_player; i++) {
          // call phrases rest API to add phrases
          await request(app)
            .post(`/api/games/${gameCode}/phrases`)
            .send({
              phrases: `Test phrase ${i + 1} from ${player.name}`,
              playerId: player.id
            });
        }
      }

      const response = await request(app)
        .post(`/api/games/${gameCode}/start`)
        .expect(200);

      return { scenario, dataStore };
  }

  describe('Success Cases', () => {
    it('should start round 1 successfully', async () => {
      // Setup game in round_intro status
      const { scenario, dataStore } = await setupGameInRoundIntro();

      // Make API call
      const response = await request(app)
        .post(`/api/games/${gameCode}/rounds/start`)
        .send({});

      // Check response
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        round: 1,
        roundName: 'Taboo',
        currentTurnId: expect.any(String),
        currentPlayer: {
          id: expect.any(String),
          teamId: expect.any(String),
        },
        startedAt: expect.any(String),
      });

      // Check that game state was updated correctly
      const updatedGame = await findById<Game>('games', gameCode);
      expect(updatedGame).toBeTruthy();
      expect(updatedGame!.status).toBe('playing');
      expect(updatedGame!.sub_status).toBe('turn_starting');
      expect(updatedGame!.current_turn_id).toBe(response.body.currentTurnId);

      // Check that a turn was created
      const turns = await select<Turn>('turns', {
        where: [
          { field: 'game_id', operator: '=', value: gameCode },
          { field: 'id', operator: '=', value: response.body.currentTurnId }
        ]
      });
      expect(turns.length).toBe(1);
      expect(turns[0]).toMatchObject({
        game_id: gameCode,
        round: 1,
        player_id: response.body.currentPlayer.id,
        team_id: response.body.currentPlayer.teamId,
        is_complete: 0, // SQLite represents false as 0
      });      
      
      // Socket broadcasting is tested separately since we have mocked it
      // and we don't need to verify the exact call signature in this test

      // Check that skipped phrases were reset to active
      const phrases = await select<Phrase>('phrases', {
        where: [
          { field: 'game_id', operator: '=', value: gameCode },
          { field: 'status', operator: '=', value: 'skipped' }
        ]
      });
      expect(phrases.length).toBe(0);
    });
  });

  describe('Error Cases', () => {
    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .post('/api/games/INVALID/rounds/start')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app)
        .post('/api/games/NONEXS/rounds/start')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Game not found');
    });

    it('should return 400 if game is not in round_intro state', async () => {
      // Setup game in turn_active status
      const game = gameFactory.waiting({
        id: gameCode,
        status: 'playing',
        sub_status: 'turn_active', // Not round_intro
        current_round: 1,
        current_team: 1,
        started_at: new Date().toISOString(),
      });

      await insert('games', game);

      const response = await request(app)
        .post(`/api/games/${gameCode}/rounds/start`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('correct state');
    });
  });
});

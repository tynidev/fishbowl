import request from 'supertest';
import { Application } from 'express';
import {
  setupTestApp,
  setupMockTransaction,
  resetAllMocks,
  mockedDbUtils,
  createMockGame,
  createMockPlayer,
  createMockTeam
} from './test-utils';
import { Player, Team } from '../db/schema';

describe('Players API', () => {
  let app: Application;
  let mockTransaction: any;

  beforeEach(() => {
    app = setupTestApp();
    mockTransaction = setupMockTransaction();
    resetAllMocks();
  });

  describe('GET /api/games/:gameCode/players', () => {
    const gameCode = 'ABC123';
    const mockGame = createMockGame({
      id: gameCode,
      name: 'Test Game',
      status: 'waiting',
      host_player_id: 'host-id'
    });

    const mockPlayers: Player[] = [
      createMockPlayer({
        id: 'player-1',
        game_id: gameCode,
        name: 'Player 1',
        team_id: 'team-1',
        is_connected: true
      }),
      createMockPlayer({
        id: 'player-2',
        game_id: gameCode,
        name: 'Player 2',
        team_id: 'team-2',
        is_connected: false
      })
    ];

    const mockTeams: Team[] = [
      createMockTeam({
        id: 'team-1',
        game_id: gameCode,
        name: 'Red Team',
        color: '#FF0000'
      }),
      createMockTeam({
        id: 'team-2',
        game_id: gameCode,
        name: 'Blue Team',
        color: '#0000FF'
      })
    ];

    beforeEach(() => {
      // Reset mocks to clear any interference from previous describe blocks
      mockedDbUtils.findById.mockReset();
      mockedDbUtils.select.mockReset();

      mockedDbUtils.findById.mockResolvedValue(mockGame);
      mockedDbUtils.select
        .mockResolvedValueOnce(mockPlayers) // Players
        .mockResolvedValueOnce(mockTeams); // Teams
    });

    it('should return players list successfully', async () => {
      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expect(response.body).toMatchObject({
        players: [
          {
            id: 'player-1',
            name: 'Player 1',
            teamId: 'team-1',
            teamName: 'Red Team',
            isConnected: true,
            joinedAt: '2023-01-01T00:00:00Z'
          },
          {
            id: 'player-2',
            name: 'Player 2',
            teamId: 'team-2',
            teamName: 'Blue Team',
            isConnected: false,
            joinedAt: '2023-01-01T00:00:00Z'
          }
        ],
        totalCount: 2
      });
    });

    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .get('/api/games/INVALID/players')
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    it('should return 404 for non-existent game', async () => {
      mockedDbUtils.findById.mockResolvedValue(undefined);

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });
  });
});

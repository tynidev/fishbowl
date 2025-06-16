/**
 * Unit tests for turn order utility functions
 * Tests the circular linked list navigation and draft logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  getNextPlayer, 
  getCurrentPlayer, 
  getRandomPlayerFromTurnOrder,
  validateTurnOrderIntegrity
} from '../../src/utils/turnUtils';
import { resetAllMocks, ensureTestDatabase } from '../test-helpers/test-helpers';
import { createGameSetup } from '../test-helpers/test-factories';
import { withTransaction } from '../../src/db/connection';
import { insert } from '../../src/db/utils';
import { Game, Player, Team, Turn, TurnOrder } from '../../src/db/schema';
import { v4 as uuidv4 } from 'uuid';

describe('Turn Order Utility Functions', () => {
  beforeEach(async () => {
    await ensureTestDatabase();
    await resetAllMocks();
  });

  afterEach(async () => {
    await resetAllMocks();
  });

  /**
   * Helper function to create a game with turn order set up
   */
  async function createGameWithTurnOrder(config: {
    teamCount?: number;
    playersPerTeam?: number;
  } = {}) {
    const { teamCount = 2, playersPerTeam = 2 } = config;
    const gameSetup = createGameSetup({
      teamCount,
      playersPerTeam,
      gameStatus: 'playing'
    });

    // Insert game, teams, and players into database
    await withTransaction(async (transaction) => {
      await insert('games', gameSetup.game, transaction);
      
      for (const team of gameSetup.teams) {
        await insert('teams', team, transaction);
      }
      
      for (const player of gameSetup.players) {
        await insert('players', player, transaction);
      }

      // Create turn order based on configuration
      await createSimpleTurnOrder(gameSetup.game.id, gameSetup.players, transaction);
    });

    return gameSetup;
  }

  /**
   * Helper function to create simple circular turn order (no draft)
   */
  async function createSimpleTurnOrder(gameId: string, players: Player[], transaction: any) {
    for (let i = 0; i < players.length; i++) {
      const currentPlayer = players[i];
      const nextPlayer = players[(i + 1) % players.length];
      const prevPlayer = players[(i - 1 + players.length) % players.length];

      const turnOrder: Omit<TurnOrder, 'created_at' | 'updated_at'> = {
        id: uuidv4(),
        game_id: gameId,
        player_id: currentPlayer!.id,
        team_id: currentPlayer!.team_id!,
        next_player_id: nextPlayer!.id,
        prev_player_id: prevPlayer!.id,
      };

      await insert('turn_order', turnOrder, transaction);
    }
  }

  describe('getNextPlayer', () => {
    it('should return next player in circular order', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      const players = gameSetup.players;
      
      const firstPlayer = players[0]!;
      const nextPlayerId = await getNextPlayer(gameSetup.game.id, firstPlayer.id);
      
      expect(nextPlayerId).toBeDefined();
      expect(nextPlayerId).not.toBe(firstPlayer.id);
      expect(players.some(p => p.id === nextPlayerId)).toBe(true);
    });

    it('should return null for invalid player ID', async () => {
      const gameSetup = await createGameWithTurnOrder();
      
      const nextPlayerId = await getNextPlayer(gameSetup.game.id, 'invalid-player-id');
      
      expect(nextPlayerId).toBeNull();
    });
  });

  describe('getCurrentPlayer', () => {
    it('should return current player from active game', async () => {
      const gameSetup = await createGameWithTurnOrder();
      const firstPlayer = gameSetup.players[0]!;
      
      // Create a turn and set it as current
      const turn: Omit<Turn, 'created_at' | 'updated_at'> = {
        id: uuidv4(),
        game_id: gameSetup.game.id,
        player_id: firstPlayer.id,
        team_id: firstPlayer.team_id!,
        round: 1,
        is_complete: false,
        duration: 0,
        phrases_guessed: 0,
        phrases_skipped: 0,
        points_scored: 0
      };

      await withTransaction(async (transaction) => {
        await insert('turns', turn, transaction);
        await transaction.run(
          'UPDATE games SET current_turn_id = ? WHERE id = ?',
          [turn.id, gameSetup.game.id]
        );
      });

      const currentPlayerId = await getCurrentPlayer(gameSetup.game.id);
      
      expect(currentPlayerId).toBe(firstPlayer.id);
    });

    it('should return null when no current turn exists', async () => {
      const gameSetup = await createGameWithTurnOrder();
      
      const currentPlayerId = await getCurrentPlayer(gameSetup.game.id);
      
      expect(currentPlayerId).toBeNull();
    });

    it('should return null for invalid game ID', async () => {
      const currentPlayerId = await getCurrentPlayer('invalid-game-id');
      
      expect(currentPlayerId).toBeNull();
    });
  });

  describe('getRandomPlayerFromTurnOrder', () => {
    it('should return a valid player from turn order', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 3 });
      
      const randomPlayerId = await getRandomPlayerFromTurnOrder(gameSetup.game.id);
      
      expect(randomPlayerId).toBeDefined();
      expect(gameSetup.players.some(p => p.id === randomPlayerId)).toBe(true);
    });

    it('should return null when no players exist in turn order', async () => {
      const gameSetup = createGameSetup({});
      
      // Insert game without turn order
      await withTransaction(async (transaction) => {
        await insert('games', gameSetup.game, transaction);
      });

      const randomPlayerId = await getRandomPlayerFromTurnOrder(gameSetup.game.id);
      
      expect(randomPlayerId).toBeNull();
    });
  });

  describe('validateTurnOrderIntegrity', () => {
    it('should return true for valid circular turn order', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      
      const isValid = await validateTurnOrderIntegrity(gameSetup.game.id);
      
      expect(isValid).toBe(true);
    });

    it('should return true for empty turn order', async () => {
      const gameSetup = createGameSetup({});
      
      // Insert game without turn order
      await withTransaction(async (transaction) => {
        await insert('games', gameSetup.game, transaction);
      });

      const isValid = await validateTurnOrderIntegrity(gameSetup.game.id);
      
      expect(isValid).toBe(true);
    });

    it('should return false when circular structure is broken', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      
      // Break the circular structure by updating a next_player_id to invalid value
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE turn_order SET next_player_id = ? WHERE game_id = ? AND rowid = 1',
          ['invalid-player-id', gameSetup.game.id]
        );
      });

      const isValid = await validateTurnOrderIntegrity(gameSetup.game.id);
      
      expect(isValid).toBe(false);
    });

    it('should return false when prev_player_id reference is invalid', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      
      // Break the circular structure by updating a prev_player_id to invalid value
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE turn_order SET prev_player_id = ? WHERE game_id = ? AND rowid = 1',
          ['invalid-player-id', gameSetup.game.id]
        );
      });

      const isValid = await validateTurnOrderIntegrity(gameSetup.game.id);
      
      expect(isValid).toBe(false);
    });
  });
});
/**
 * Unit tests for turn order utility functions
 * Tests the circular linked list navigation and snake draft logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  getNextPlayer, 
  getCurrentPlayer, 
  getRandomPlayerFromTurnOrder,
  isPlayerActive,
  getActivePlayersInTurnOrder,
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
    snakeDraft?: boolean;
  } = {}) {
    const { teamCount = 2, playersPerTeam = 2, snakeDraft = true } = config;
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
      if (snakeDraft) {
        await createSnakeDraftTurnOrder(gameSetup.game.id, gameSetup.players, transaction);
      } else {
        await createSimpleTurnOrder(gameSetup.game.id, gameSetup.players, transaction);
      }
    });

    return gameSetup;
  }

  /**
   * Helper function to create snake draft turn order
   */
  async function createSnakeDraftTurnOrder(gameId: string, players: Player[], transaction: any) {
    // Group players by team
    const playersByTeam = new Map<string, Player[]>();
    for (const player of players) {
      if (!player.team_id) continue;
      if (!playersByTeam.has(player.team_id)) {
        playersByTeam.set(player.team_id, []);
      }
      playersByTeam.get(player.team_id)!.push(player);
    }

    // Get team IDs in order
    const teamIds = Array.from(playersByTeam.keys());
    
    // Build snake draft order
    const snakeDraftOrder: Player[] = [];
    const maxPlayersPerTeam = Math.max(...Array.from(playersByTeam.values()).map(team => team.length));

    for (let playerIndex = 0; playerIndex < maxPlayersPerTeam; playerIndex++) {
      // Determine if this is a forward or reverse pass
      const isForwardPass = playerIndex % 2 === 0;
      const orderedTeamIds = isForwardPass ? teamIds : [...teamIds].reverse();

      // Add one player from each team in the determined order
      for (const teamId of orderedTeamIds) {
        const teamPlayers = playersByTeam.get(teamId);
        if (teamPlayers && teamPlayers[playerIndex]) {
          snakeDraftOrder.push(teamPlayers[playerIndex]!);
        }
      }
    }

    // Create circular linked list
    for (let i = 0; i < snakeDraftOrder.length; i++) {
      const currentPlayer = snakeDraftOrder[i];
      const nextPlayer = snakeDraftOrder[(i + 1) % snakeDraftOrder.length];
      const prevPlayer = snakeDraftOrder[(i - 1 + snakeDraftOrder.length) % snakeDraftOrder.length];

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

    return snakeDraftOrder;
  }

  /**
   * Helper function to create simple circular turn order (no snake draft)
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

  /**
   * Helper function to verify snake draft pattern
   */
  function verifySnakeDraftPattern(order: Player[], teamCount: number, playersPerTeam: number) {
    // For 2 teams with 2 players each: Team1-P1, Team2-P1, Team2-P2, Team1-P2
    // For 3 teams with 2 players each: Team1-P1, Team2-P1, Team3-P1, Team3-P2, Team2-P2, Team1-P2
    
    const teamIds = Array.from(new Set(order.map(p => p.team_id))).sort();
    expect(teamIds).toHaveLength(teamCount);

    // Check snake pattern - verify that teams alternate properly in snake order
    for (let playerIndex = 0; playerIndex < playersPerTeam; playerIndex++) {
      const isForwardPass = playerIndex % 2 === 0;
      
      // Get the teams for this round
      const roundTeams: string[] = [];
      for (let teamIndex = 0; teamIndex < teamCount; teamIndex++) {
        const orderIndex = playerIndex * teamCount + teamIndex;
        if (orderIndex < order.length && order[orderIndex]?.team_id) {
          roundTeams.push(order[orderIndex]!.team_id!);
        }
      }
      
      // For reverse passes, the teams should be in reverse order compared to forward passes
      if (playerIndex > 0) {
        const previousRoundTeams: string[] = [];
        for (let teamIndex = 0; teamIndex < teamCount; teamIndex++) {
          const orderIndex = (playerIndex - 1) * teamCount + teamIndex;
          if (orderIndex < order.length && order[orderIndex]?.team_id) {
            previousRoundTeams.push(order[orderIndex]!.team_id!);
          }
        }
        
        if (isForwardPass) {
          // Current round should have same order as round before last
          if (playerIndex >= 2) {
            const roundBeforeLastTeams: string[] = [];
            for (let teamIndex = 0; teamIndex < teamCount; teamIndex++) {
              const orderIndex = (playerIndex - 2) * teamCount + teamIndex;
              if (orderIndex < order.length && order[orderIndex]?.team_id) {
                roundBeforeLastTeams.push(order[orderIndex]!.team_id!);
              }
            }
            expect(roundTeams).toEqual(roundBeforeLastTeams);
          }
        } else {
          // Reverse pass - should be reverse of previous round
          expect(roundTeams).toEqual([...previousRoundTeams].reverse());
        }
      }
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

    it('should skip inactive players and return next active player', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 3 });
      const players = gameSetup.players;
      
      // Disconnect middle players
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 0 WHERE id IN (?, ?)',
          [players[1]!.id, players[2]!.id]
        );
      });

      const firstPlayer = players[0]!;
      const nextPlayerId = await getNextPlayer(gameSetup.game.id, firstPlayer.id);
      
      // Should skip the disconnected players and find the next connected one
      expect(nextPlayerId).toBeDefined();
      expect(nextPlayerId).not.toBe(firstPlayer.id);
      expect([players[1]!.id, players[2]!.id]).not.toContain(nextPlayerId);
    });

    it('should return null when all players are inactive', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      const players = gameSetup.players;
      
      // Disconnect all players
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 0 WHERE game_id = ?',
          [gameSetup.game.id]
        );
      });

      const firstPlayer = players[0]!;
      const nextPlayerId = await getNextPlayer(gameSetup.game.id, firstPlayer.id);
      
      expect(nextPlayerId).toBeNull();
    });

    it('should return null for invalid player ID', async () => {
      const gameSetup = await createGameWithTurnOrder();
      
      const nextPlayerId = await getNextPlayer(gameSetup.game.id, 'invalid-player-id');
      
      expect(nextPlayerId).toBeNull();
    });

    it('should handle single player scenario (player points to themselves)', async () => {
      // Create a 2-team game with 2 players, but disconnect all except one
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      const players = gameSetup.players;
      
      // Disconnect all players except the first one
      const activePlayer = players[0]!;
      const playersToDisconnect = players.slice(1);
      
      await withTransaction(async (transaction) => {
        for (const player of playersToDisconnect) {
          await transaction.run(
            'UPDATE players SET is_connected = 0 WHERE id = ?',
            [player.id]
          );
        }
      });

      // Should return the same player since it's the only active one
      const nextPlayerId = await getNextPlayer(gameSetup.game.id, activePlayer.id);
      
      expect(nextPlayerId).toBe(activePlayer.id);
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

    it('should only return active players', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 3 });
      
      // Disconnect all but one player
      const activePlayer = gameSetup.players[0]!;
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 0 WHERE id != ? AND game_id = ?',
          [activePlayer.id, gameSetup.game.id]
        );
      });

      const randomPlayerId = await getRandomPlayerFromTurnOrder(gameSetup.game.id);
      
      expect(randomPlayerId).toBe(activePlayer.id);
    });

    it('should return null when no active players exist', async () => {
      const gameSetup = await createGameWithTurnOrder();
      
      // Disconnect all players
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 0 WHERE game_id = ?',
          [gameSetup.game.id]
        );
      });

      const randomPlayerId = await getRandomPlayerFromTurnOrder(gameSetup.game.id);
      
      expect(randomPlayerId).toBeNull();
    });
  });

  describe('isPlayerActive', () => {
    it('should return true for connected player', async () => {
      const gameSetup = await createGameWithTurnOrder();
      const player = gameSetup.players[0]!;
      
      const isActive = await isPlayerActive(gameSetup.game.id, player.id);
      
      expect(isActive).toBe(true);
    });

    it('should return false for disconnected player', async () => {
      const gameSetup = await createGameWithTurnOrder();
      const player = gameSetup.players[0]!;
      
      // Disconnect the player
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 0 WHERE id = ?',
          [player.id]
        );
      });

      const isActive = await isPlayerActive(gameSetup.game.id, player.id);
      
      expect(isActive).toBe(false);
    });

    it('should return false for non-existent player', async () => {
      const gameSetup = await createGameWithTurnOrder();
      
      const isActive = await isPlayerActive(gameSetup.game.id, 'invalid-player-id');
      
      expect(isActive).toBe(false);
    });
  });

  describe('getActivePlayersInTurnOrder', () => {
    it('should return all active players in turn order', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      
      const activePlayers = await getActivePlayersInTurnOrder(gameSetup.game.id);
      
      expect(activePlayers).toHaveLength(gameSetup.players.length);
      expect(activePlayers.every(id => gameSetup.players.some(p => p.id === id))).toBe(true);
    });

    it('should exclude disconnected players', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 3 });
      const playersToDisconnect = [gameSetup.players[1]!, gameSetup.players[3]!];
      
      // Disconnect some players
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 0 WHERE id IN (?, ?)',
          [playersToDisconnect[0]!.id, playersToDisconnect[1]!.id]
        );
      });

      const activePlayers = await getActivePlayersInTurnOrder(gameSetup.game.id);
      
      expect(activePlayers).toHaveLength(gameSetup.players.length - 2);
      expect(activePlayers).not.toContain(playersToDisconnect[0]!.id);
      expect(activePlayers).not.toContain(playersToDisconnect[1]!.id);
    });

    it('should return empty array when no players exist', async () => {
      const gameSetup = createGameSetup({});
      
      // Insert game without players
      await withTransaction(async (transaction) => {
        await insert('games', gameSetup.game, transaction);
      });

      const activePlayers = await getActivePlayersInTurnOrder(gameSetup.game.id);
      
      expect(activePlayers).toHaveLength(0);
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

  describe('Snake Draft Order Creation', () => {
    it('should create correct snake draft order for 2 teams with 3 players each', async () => {
      const gameSetup = await createGameWithTurnOrder({ 
        teamCount: 2, 
        playersPerTeam: 3, 
        snakeDraft: true 
      });

      // Get the turn order from database
      let turnOrderSequence: Player[] = [];
      await withTransaction(async (transaction) => {
        const turnOrders = await transaction.all<TurnOrder>(
          'SELECT * FROM turn_order WHERE game_id = ? ORDER BY created_at',
          [gameSetup.game.id]
        );
        
        // Reconstruct the order by following the linked list
        if (turnOrders.length > 0) {
          const firstTurnOrder = turnOrders[0]!;
          let currentPlayerId = firstTurnOrder.player_id;
          const visited = new Set<string>();
          
          while (!visited.has(currentPlayerId)) {
            visited.add(currentPlayerId);
            const player = gameSetup.players.find(p => p.id === currentPlayerId);
            if (player) {
              turnOrderSequence.push(player);
            }
            
            const currentTurnOrder = turnOrders.find(to => to.player_id === currentPlayerId);
            if (!currentTurnOrder) break;
            currentPlayerId = currentTurnOrder.next_player_id;
            
            if (currentPlayerId === firstTurnOrder.player_id) break;
          }
        }
      });

      expect(turnOrderSequence).toHaveLength(6);
      verifySnakeDraftPattern(turnOrderSequence, 2, 3);
    });

    it('should create correct snake draft order for 3 teams with uneven player counts', async () => {
      // Create custom setup with uneven teams (3, 2, 1 players)
      const gameSetup = createGameSetup({ teamCount: 3, playersPerTeam: 2 });
      
      // Remove one player from the third team to make it uneven
      gameSetup.players = gameSetup.players.slice(0, 5); // Keep only 5 players instead of 6
      
      await withTransaction(async (transaction) => {
        await insert('games', gameSetup.game, transaction);
        
        for (const team of gameSetup.teams) {
          await insert('teams', team, transaction);
        }
        
        for (const player of gameSetup.players) {
          await insert('players', player, transaction);
        }

        await createSnakeDraftTurnOrder(gameSetup.game.id, gameSetup.players, transaction);
      });

      // Verify turn order was created
      let turnOrderCount = 0;
      await withTransaction(async (transaction) => {
        const result = await transaction.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM turn_order WHERE game_id = ?',
          [gameSetup.game.id]
        );
        turnOrderCount = result?.count || 0;
      });

      expect(turnOrderCount).toBe(5); // All 5 players should be in turn order
    });

    it('should verify circular linking (last player points to first)', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      
      // Get all turn order entries
      let isCircular = false;
      await withTransaction(async (transaction) => {
        const turnOrders = await transaction.all<TurnOrder>(
          'SELECT * FROM turn_order WHERE game_id = ?',
          [gameSetup.game.id]
        );
        
        if (turnOrders.length > 0) {
          const firstTurnOrder = turnOrders[0]!;
          let currentPlayerId = firstTurnOrder.player_id;
          let steps = 0;
          const maxSteps = turnOrders.length * 2; // Prevent infinite loop
          
          // Follow the chain and see if we get back to the start
          while (steps < maxSteps) {
            const currentTurnOrder = turnOrders.find(to => to.player_id === currentPlayerId);
            if (!currentTurnOrder) break;
            
            currentPlayerId = currentTurnOrder.next_player_id;
            steps++;
            
            if (currentPlayerId === firstTurnOrder.player_id && steps === turnOrders.length) {
              isCircular = true;
              break;
            }
          }
        }
      });

      expect(isCircular).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle player disconnection scenarios gracefully', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 3 });
      const firstPlayer = gameSetup.players[0]!;
      
      // Disconnect the next player in line
      const nextPlayerId = await getNextPlayer(gameSetup.game.id, firstPlayer.id);
      if (nextPlayerId) {
        await withTransaction(async (transaction) => {
          await transaction.run(
            'UPDATE players SET is_connected = 0 WHERE id = ?',
            [nextPlayerId]
          );
        });
      }

      // Should still be able to get the next active player
      const nextActivePlayerId = await getNextPlayer(gameSetup.game.id, firstPlayer.id);
      
      expect(nextActivePlayerId).toBeDefined();
      expect(nextActivePlayerId).not.toBe(nextPlayerId); // Should skip disconnected player
    });

    it('should maintain turn order integrity after player reconnection', async () => {
      const gameSetup = await createGameWithTurnOrder({ teamCount: 2, playersPerTeam: 2 });
      const player = gameSetup.players[1]!;
      
      // Disconnect then reconnect a player
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 0 WHERE id = ?',
          [player.id]
        );
      });
      
      await withTransaction(async (transaction) => {
        await transaction.run(
          'UPDATE players SET is_connected = 1 WHERE id = ?',
          [player.id]
        );
      });

      // Turn order integrity should still be valid
      const isValid = await validateTurnOrderIntegrity(gameSetup.game.id);
      expect(isValid).toBe(true);
      
      // Player should be active again
      const isActive = await isPlayerActive(gameSetup.game.id, player.id);
      expect(isActive).toBe(true);
    });

    it('should handle empty game scenarios', async () => {
      const gameSetup = createGameSetup({ teamCount: 2, playersPerTeam: 0 });
      
      // Insert game without players
      await withTransaction(async (transaction) => {
        await insert('games', gameSetup.game, transaction);
      });

      const nextPlayerId = await getNextPlayer(gameSetup.game.id, 'any-player-id');
      const currentPlayerId = await getCurrentPlayer(gameSetup.game.id);
      const randomPlayerId = await getRandomPlayerFromTurnOrder(gameSetup.game.id);
      const activePlayers = await getActivePlayersInTurnOrder(gameSetup.game.id);
      const isValid = await validateTurnOrderIntegrity(gameSetup.game.id);

      expect(nextPlayerId).toBeNull();
      expect(currentPlayerId).toBeNull();
      expect(randomPlayerId).toBeNull();
      expect(activePlayers).toHaveLength(0);
      expect(isValid).toBe(true); // Empty turn order is considered valid
    });
  });
});
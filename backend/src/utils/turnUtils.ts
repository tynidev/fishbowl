// Turn order utilities for managing circular linked list navigation
// Handles turn order operations for the Fishbowl game

import { withConnection } from '../db/connection';
import { Game, Player, Team, Turn, Phrase, TurnOrder } from '../db/schema';
import { TransactionConnection } from '../db/connection';
import { findById, select } from '../db/utils';

/**
 * Get the next player in the circular turn order
 * @param gameId - The game ID
 * @param currentPlayerId - The current player ID
 * @returns Promise<string | null> - Next player ID or null if no player found
 */
export async function getNextPlayer(
  gameId: string,
  currentPlayerId: string,
): Promise<string | null>
{
  return withConnection(async db =>
  {
    try
    {
      // First, get the current player's turn order entry
      const currentTurnOrder = await db.get<TurnOrder>(
        'SELECT * FROM turn_order WHERE game_id = ? AND player_id = ?',
        [gameId, currentPlayerId],
      );

      if (!currentTurnOrder)
      {
        console.warn(
          `Turn order entry not found for player ${currentPlayerId} in game ${gameId}`,
        );
        return null;
      }

      // Check if this player is in the game
      const nextPlayer = await db.get<Player>(
        'SELECT * FROM players WHERE id = ? AND game_id = ?',
        [currentTurnOrder.next_player_id, gameId],
      );

      if (nextPlayer)
      {
        return nextPlayer.id;
      }

      console.warn(
        `Turn order entry not found for player ${currentTurnOrder.next_player_id} in game ${gameId}`,
      );
      return null;
    }
    catch (error)
    {
      console.error('Error getting next player:', error);
      throw error;
    }
  });
}

/**
 * Get the current player from the game's current turn
 * @param gameId - The game ID
 * @returns Promise<string | null> - Current player ID or null if no current turn
 */
export async function getCurrentPlayer(gameId: string): Promise<string | null>
{
  return withConnection(async db =>
  {
    try
    {
      // Get the game's current turn ID
      const game = await db.get<Game>(
        'SELECT current_turn_id FROM games WHERE id = ?',
        [gameId],
      );

      if (!game || !game.current_turn_id)
      {
        return null;
      }

      // Get the player ID from the current turn
      const turn = await db.get<Turn>(
        'SELECT player_id FROM turns WHERE id = ?',
        [game.current_turn_id],
      );

      return turn?.player_id || null;
    }
    catch (error)
    {
      console.error('Error getting current player:', error);
      throw error;
    }
  });
}

/**
 * Select a random player from the turn order to start the game
 * @param gameId - The game ID
 * @returns Promise<string | null> - Random player ID or null if no players in turn order
 */
export async function getRandomPlayerFromTurnOrder(
  gameId: string,
): Promise<string | null>
{
  return withConnection(async db =>
  {
    try
    {
      // Get all players in the turn order
      const players = await db.all<{ player_id: string; }>(
        `SELECT DISTINCT turn_order.player_id
         FROM turn_order
         INNER JOIN players p ON turn_order.player_id = p.id
         WHERE turn_order.game_id = ?`,
        [gameId],
      );

      if (players.length === 0)
      {
        return null;
      }

      // Select a random player
      const randomIndex = Math.floor(Math.random() * players.length);
      const randomPlayer = players[randomIndex];
      return randomPlayer ? randomPlayer.player_id : null;
    }
    catch (error)
    {
      console.error('Error getting random player from turn order:', error);
      throw error;
    }
  });
}

/**
 * Validate that the turn order structure is intact for a game
 * @param gameId - The game ID
 * @returns Promise<boolean> - True if turn order is valid, false otherwise
 */
export async function validateTurnOrderIntegrity(
  gameId: string,
): Promise<boolean>
{
  return withConnection(async db =>
  {
    try
    {
      // Get all turn order entries for the game
      const turnOrders = await db.all<TurnOrder>(
        'SELECT * FROM turn_order WHERE game_id = ?',
        [gameId],
      );

      if (turnOrders.length === 0)
      {
        return true; // Empty turn order is considered valid
      }

      // Check that each player's next_player_id points to an existing player in the turn order
      for (const turnOrder of turnOrders)
      {
        const nextPlayerExists = turnOrders.some(
          to => to.player_id === turnOrder.next_player_id,
        );
        const prevPlayerExists = turnOrders.some(
          to => to.player_id === turnOrder.prev_player_id,
        );

        if (!nextPlayerExists || !prevPlayerExists)
        {
          console.warn(
            `Turn order integrity check failed for game ${gameId}: Invalid references for player ${turnOrder.player_id}`,
          );
          return false;
        }
      }

      // Check that the circular structure is complete (we can traverse from any player back to itself)
      const startPlayer = turnOrders[0];
      if (!startPlayer)
      {
        return true; // Empty turn order is valid
      }

      let currentPlayerId = startPlayer.next_player_id;
      const visited = new Set<string>([startPlayer.player_id]);

      while (currentPlayerId !== startPlayer.player_id)
      {
        if (visited.has(currentPlayerId))
        {
          console.warn(
            `Turn order integrity check failed for game ${gameId}: Circular structure broken`,
          );
          return false;
        }

        visited.add(currentPlayerId);
        const currentTurnOrder = turnOrders.find(
          to => to.player_id === currentPlayerId,
        );

        if (!currentTurnOrder)
        {
          console.warn(
            `Turn order integrity check failed for game ${gameId}: Missing turn order for player ${currentPlayerId}`,
          );
          return false;
        }

        currentPlayerId = currentTurnOrder.next_player_id;
      }

      // Verify all players were visited
      if (visited.size !== turnOrders.length)
      {
        console.warn(
          `Turn order integrity check failed for game ${gameId}: Not all players are connected in the circular structure`,
        );
        return false;
      }

      return true;
    }
    catch (error)
    {
      console.error('Error validating turn order integrity:', error);
      return false;
    }
  });
}

/**
 * Get the next player in turn order from the circular linked list
 * If currentPlayerId is null, return the first player in the turn order
 * 
 * @param gameId - The game ID
 * @param currentTurnId - The current turn ID (or null to get the first player)
 * @param transaction - Optional database transaction
 * @returns Promise<string | null> - Next player ID or null if no player found
 */
export async function getNextPlayerInTurnOrder(
  gameId: string,
  currentTurnId: string | undefined,
  transaction?: TransactionConnection
): Promise<string | null> {
  try {
    // If currentTurnId is undefined, get a random starting player
    if (!currentTurnId) {
      // Select random starting player from turn order
      const randomStartingPlayerId = await getRandomPlayerFromTurnOrder(gameId);
      if (!randomStartingPlayerId)
      {
        return null;
      }
      return randomStartingPlayerId;
    }

    // Get the current player's turn entry
    const turn = await findById<Turn>(
      'turns',
      currentTurnId,
      transaction
    );

    if (!turn) {
      return null;
    }

    const currentTurnOrder = await select<TurnOrder>('turn_order',
      {
        where: [
          { field: 'game_id', operator: '=', value: gameId },
          { field: 'player_id', operator: '=', value: turn.player_id }
        ],
        limit: 1
      },
      transaction
    );

    // If there's only one player in the turn order, return their next player ID
    if (currentTurnOrder.length === 1 && currentTurnOrder[0]) {
      // Return the next player in the turn order
      return currentTurnOrder[0].next_player_id;
    }

    return null;
  }
  catch (error) {
    console.error('Error getting next player in turn order:', error);
    throw error;
  }
}

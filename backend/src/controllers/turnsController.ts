import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Game, Turn, Player } from '../db/schema';
import {
  findById,
  update,
  insert,
} from '../db/utils';
import { withTransaction, TransactionConnection } from '../db/connection';
import { getCurrentPlayer, getNextPlayer } from '../utils/turnUtils';

/**
 * POST /games/:gameId/turns/end - End the current turn and progress to next player
 */
export async function endTurn(req: Request, res: Response): Promise<void> {
  try {
    const { gameId } = req.params;
    const { playerId } = req.body; // Player requesting to end the turn

    // Validate required parameters
    if (!gameId || typeof gameId !== 'string') {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    if (!playerId || typeof playerId !== 'string') {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) => {
      // 1. Validate game exists and is in progress
      const game = await findById<Game>('games', gameId, transaction);
      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'playing') {
        res.status(400).json({ 
          error: 'Game is not in progress',
          currentStatus: game.status 
        });
        return;
      }

      // 2. Get current player from the game's current turn
      const currentPlayerId = await getCurrentPlayer(gameId);
      if (!currentPlayerId) {
        res.status(400).json({ error: 'No current turn found' });
        return;
      }

      // 3. Verify the requesting player is the current player (security check)
      if (currentPlayerId !== playerId) {
        res.status(403).json({ 
          error: 'Not your turn',
          currentPlayer: currentPlayerId 
        });
        return;
      }

      // 4. Verify the current player is connected
      const currentPlayer = await findById<Player>('players', currentPlayerId, transaction);
      if (!currentPlayer || !currentPlayer.is_connected) {
        res.status(400).json({ error: 'Current player is not connected' });
        return;
      }

      // 5. Get the current turn to complete it
      if (!game.current_turn_id) {
        res.status(400).json({ error: 'No current turn to end' });
        return;
      }

      const currentTurn = await findById<Turn>('turns', game.current_turn_id, transaction);
      if (!currentTurn) {
        res.status(400).json({ error: 'Current turn not found' });
        return;
      }

      // 6. Mark the current turn as complete
      const endTime = new Date().toISOString();
      await update(
        'turns',
        { 
          end_time: endTime,
          is_complete: true 
        },
        [{ field: 'id', operator: '=', value: currentTurn.id }],
        transaction
      );

      // 7. Get the next player using turn order
      const nextPlayerId = await getNextPlayer(gameId, currentPlayerId);
      if (!nextPlayerId) {
        res.status(400).json({ 
          error: 'No next player available',
          message: 'All other players may be disconnected' 
        });
        return;
      }

      // 8. Get the next player's details for creating the new turn
      const nextPlayer = await findById<Player>('players', nextPlayerId, transaction);
      if (!nextPlayer || !nextPlayer.team_id) {
        res.status(400).json({ error: 'Next player not found or not assigned to a team' });
        return;
      }

      // 9. Create a new turn for the next player
      const newTurn: Omit<Turn, 'created_at' | 'updated_at'> = {
        id: uuidv4(),
        game_id: gameId,
        round: game.current_round,
        team_id: nextPlayer.team_id,
        player_id: nextPlayerId,
        duration: 0,
        phrases_guessed: 0,
        phrases_skipped: 0,
        points_scored: 0,
        is_complete: false,
      };

      await insert('turns', newTurn, transaction);

      // 10. Update the game's current_turn_id to point to the new turn
      await update(
        'games',
        { 
          current_turn_id: newTurn.id,
          sub_status: 'turn_starting' // Brief moment between turns
        },
        [{ field: 'id', operator: '=', value: gameId }],
        transaction
      );

      // 11. Get updated game state for response
      const updatedGame = await findById<Game>('games', gameId, transaction);
      if (!updatedGame) {
        res.status(500).json({ error: 'Failed to get updated game state' });
        return;
      }

      // 12. Prepare response with updated game state
      const response = {
        success: true,
        message: 'Turn ended successfully',
        game: {
          id: updatedGame.id,
          status: updatedGame.status,
          sub_status: updatedGame.sub_status,
          current_round: updatedGame.current_round,
          current_turn_id: updatedGame.current_turn_id,
        },
        previousTurn: {
          id: currentTurn.id,
          player_id: currentTurn.player_id,
          completed: true,
        },
        nextTurn: {
          id: newTurn.id,
          player_id: newTurn.player_id,
          team_id: newTurn.team_id,
          round: newTurn.round,
        },
        nextPlayer: {
          id: nextPlayer.id,
          name: nextPlayer.name,
          team_id: nextPlayer.team_id,
        }
      };

      // TODO: Emit socket events for turn changes (to be implemented in next step)
      // This will notify all clients about the turn change
      
      res.status(200).json(response);
    });

  } catch (error) {
    console.error('Error ending turn:', error);
    res.status(500).json({
      error: 'Failed to end turn',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
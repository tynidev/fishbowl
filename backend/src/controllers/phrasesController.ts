/**
 * Phrases Controller
 * Handles phrase submission, retrieval, editing, and deletion
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TransactionConnection, withTransaction } from '../db/connection';
import { Game, Phrase, Player } from '../db/schema';
import { findById, insert, select, update } from '../db/utils';
import {
  GetPhrasesResponse,
  GetPhraseStatusResponse,
  PhraseSubmissionStatus,
  SubmitOrUpdatePhraseResponse,
  SubmitPhrasesRequest,
  UpdatePhraseRequest,
} from '../types/rest-api';
import { validatePhrase, validatePhrases } from '../utils/validators';

/**
 * POST /api/games/:gameCode/phrases - Submit phrases for a player
 */
export async function submitPhrases(
  req: Request,
  res: Response,
): Promise<void>
{
  try
  {
    const { gameCode } = req.params;
    const { phrases: phrasesInput, playerId }: SubmitPhrasesRequest = req.body;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Validate player ID
    if (!playerId || typeof playerId !== 'string')
    {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    // Normalize phrases to array
    const phrasesArray = Array.isArray(phrasesInput) ?
      phrasesInput :
      [phrasesInput];

    // Validate phrases
    const phrasesValidation = validatePhrases(phrasesArray);
    if (!phrasesValidation.isValid)
    {
      res
        .status(400)
        .json({ error: 'Invalid phrases', details: phrasesValidation.errors });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Verify game exists and is in correct state
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game)
      {
        res.status(404).json({ error: 'Game not found' });
        return;
      }
      if (game.status !== 'setup')
      {
        res
          .status(400)
          .json({ error: 'Cannot submit phrases after game has started' });
        return;
      }

      // Verify player exists in game
      const player = await findById<Player>('players', playerId, transaction);
      if (!player || player.game_id !== gameCode)
      {
        res.status(400).json({ error: 'Player not found in this game' });
        return;
      }

      // Get existing phrases for this player
      const existingPhrases = await select<Phrase>(
        'phrases',
        {
          where: [
            { field: 'game_id', operator: '=', value: gameCode },
            { field: 'player_id', operator: '=', value: playerId },
          ],
        },
        transaction,
      );

      // Check if adding new phrases would exceed limit
      const totalPhrasesAfterSubmission = existingPhrases.length + phrasesArray.length;
      if (totalPhrasesAfterSubmission > game.phrases_per_player)
      {
        res.status(400).json({
          error:
            `Cannot submit ${phrasesArray.length} phrases. Player can submit maximum ${game.phrases_per_player} phrases total. Currently has ${existingPhrases.length} phrases.`,
        });
        return;
      }

      // Check for duplicates within the game
      const allGamePhrases = await select<Phrase>(
        'phrases',
        {
          where: [{ field: 'game_id', operator: '=', value: gameCode }],
        },
        transaction,
      );

      const existingPhrasesLower = new Set(
        allGamePhrases
          .filter(p => p.text && typeof p.text === 'string')
          .map(p => p.text.toLowerCase()),
      );
      const duplicates: string[] = [];

      for (const phrase of phrasesArray)
      {
        if (existingPhrasesLower.has(phrase.trim().toLowerCase()))
        {
          duplicates.push(phrase.trim());
        }
      }

      if (duplicates.length > 0)
      {
        res.status(400).json({
          error: 'Duplicate phrases detected',
          details: [
            `The following phrases already exist in this game: ${duplicates.join(', ')}`,
          ],
        });
        return;
      }

      // Insert new phrases
      const submittedPhrases: {
        id: string;
        text: string;
        submittedAt: string;
      }[] = [];
      const now = new Date().toISOString();

      for (const phraseText of phrasesArray)
      {
        const phraseId = uuidv4();
        const phrase: Omit<Phrase, 'created_at' | 'updated_at'> = {
          id: phraseId,
          game_id: gameCode,
          player_id: playerId,
          text: phraseText.trim(),
          status: 'active',
        };

        await insert('phrases', phrase, transaction);
        submittedPhrases.push({
          id: phraseId,
          text: phraseText.trim(),
          submittedAt: now,
        });
      }

      // Note: Game stays in 'setup' status during phrase submission
      // Status will change to 'playing' when host starts the game

      const response: SubmitOrUpdatePhraseResponse = {
        submittedCount: phrasesArray.length,
        totalRequired: game.phrases_per_player,
        phrases: submittedPhrases,
      };

      res.status(201).json(response);
    });
  }
  catch (error)
  {
    console.error('Error submitting phrases:', error);
    res.status(500).json({
      error: 'Failed to submit phrases',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/games/:gameCode/phrases - Get phrases for the game (admin/host only)
 */
export async function getGamePhrases(
  req: Request,
  res: Response,
): Promise<void>
{
  try
  {
    const { gameCode } = req.params;
    const { playerId } = req.query;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Verify game exists
    const game = await findById<Game>('games', gameCode);
    if (!game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Verify authorization - only host can view all phrases
    if (playerId && typeof playerId === 'string')
    {
      const player = await findById<Player>('players', playerId);
      if (!player || player.game_id !== gameCode)
      {
        res.status(403).json({ error: 'Player not found in this game' });
        return;
      }

      if (player.id !== game.host_player_id)
      {
        res
          .status(403)
          .json({ error: 'Only the game host can view all phrases' });
        return;
      }
    }
    else
    {
      res
        .status(400)
        .json({ error: 'Player ID is required for authorization' });
      return;
    }

    // Get all phrases for the game
    const phrases = await select<Phrase>('phrases', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
      orderBy: [{ field: 'created_at', direction: 'ASC' }],
    });

    // Get all players to map player names
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
    });

    const playerMap = new Map(players.map(p => [p.id, p.name]));

    const phrasesWithPlayer = phrases.map(phrase => ({
      id: phrase.id,
      text: phrase.text,
      playerId: phrase.player_id,
      playerName: playerMap.get(phrase.player_id) || 'Unknown Player',
      submittedAt: phrase.created_at,
    }));

    const response: GetPhrasesResponse = {
      phrases: phrasesWithPlayer,
      totalCount: phrases.length,
      gameInfo: {
        phrasesPerPlayer: game.phrases_per_player,
        totalPlayers: players.length,
        totalExpected: players.length * game.phrases_per_player,
      },
    };

    res.status(200).json(response);
  }
  catch (error)
  {
    console.error('Error getting game phrases:', error);
    res.status(500).json({
      error: 'Failed to get game phrases',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/games/:gameCode/phrases/status - Get phrase submission status for all players
 */
export async function getPhraseSubmissionStatus(
  req: Request,
  res: Response,
): Promise<void>
{
  try
  {
    const { gameCode } = req.params;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Verify game exists
    const game = await findById<Game>('games', gameCode);
    if (!game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get all players in the game
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
      orderBy: [{ field: 'created_at', direction: 'ASC' }],
    });

    // Get all phrases for the game
    const phrases = await select<Phrase>('phrases', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
    });

    // Count phrases per player
    const phraseCountMap = new Map<string, number>();
    for (const phrase of phrases)
    {
      phraseCountMap.set(
        phrase.player_id,
        (phraseCountMap.get(phrase.player_id) || 0) + 1,
      );
    }

    // Build status for each player
    const playerStatuses: PhraseSubmissionStatus[] = players.map(player =>
    {
      const submitted = phraseCountMap.get(player.id) || 0;
      return {
        playerId: player.id,
        playerName: player.name,
        submitted,
        required: game.phrases_per_player,
        isComplete: submitted >= game.phrases_per_player,
      };
    });

    const playersComplete = playerStatuses.filter(p => p.isComplete).length;
    const totalPhrasesSubmitted = phrases.length;
    const totalPhrasesRequired = players.length * game.phrases_per_player;

    const response: GetPhraseStatusResponse = {
      players: playerStatuses,
      summary: {
        totalPlayers: players.length,
        playersComplete,
        totalPhrasesSubmitted,
        totalPhrasesRequired,
        isAllComplete: playersComplete === players.length && players.length > 0,
      },
    };

    res.status(200).json(response);
  }
  catch (error)
  {
    console.error('Error getting phrase submission status:', error);
    res.status(500).json({
      error: 'Failed to get phrase submission status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/games/:gameCode/phrases/:phraseId - Edit a specific phrase
 */
export async function updatePhrase(req: Request, res: Response): Promise<void>
{
  try
  {
    const { gameCode, phraseId } = req.params;
    const { text }: UpdatePhraseRequest = req.body;
    const { playerId } = req.query;

    // Validate parameters
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    if (!phraseId || typeof phraseId !== 'string')
    {
      res.status(400).json({ error: 'Invalid phrase ID' });
      return;
    }

    if (!playerId || typeof playerId !== 'string')
    {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    // Validate new phrase text
    const phraseValidation = validatePhrase(text);
    if (!phraseValidation.isValid)
    {
      res.status(400).json({ error: phraseValidation.error });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Verify game exists and is in correct state
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game)
      {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'setup')
      {
        res
          .status(400)
          .json({ error: 'Cannot edit phrases after game has started' });
        return;
      }

      // Verify phrase exists and belongs to the player
      const phrase = await findById<Phrase>('phrases', phraseId, transaction);
      if (!phrase)
      {
        res.status(404).json({ error: 'Phrase not found' });
        return;
      }

      if (phrase.game_id !== gameCode)
      {
        res.status(400).json({ error: 'Phrase does not belong to this game' });
        return;
      }

      if (phrase.player_id !== playerId)
      {
        res.status(403).json({ error: 'You can only edit your own phrases' });
        return;
      }

      // Check for duplicates (excluding current phrase)
      const existingPhrases = await select<Phrase>(
        'phrases',
        {
          where: [
            { field: 'game_id', operator: '=', value: gameCode },
            { field: 'id', operator: '!=', value: phraseId },
          ],
        },
        transaction,
      );

      const existingTexts = new Set(
        existingPhrases.map(p => p.text?.toLowerCase()).filter(Boolean),
      );
      if (existingTexts.has(text.trim().toLowerCase()))
      {
        res
          .status(400)
          .json({ error: 'This phrase already exists in the game' });
        return;
      }

      // Update the phrase
      const updatedAt = new Date().toISOString();
      await update(
        'phrases',
        { text: text.trim(), updated_at: updatedAt },
        [{ field: 'id', operator: '=', value: phraseId }],
        transaction,
      );

      const response: SubmitOrUpdatePhraseResponse = {
        submittedCount: 1,
        totalRequired: game.phrases_per_player,
        phrases: [
          {
            id: phraseId,
            text: text.trim(),
            submittedAt: updatedAt,
          },
        ],
      };

      res.status(200).json(response);
    });
  }
  catch (error)
  {
    console.error('Error updating phrase:', error);
    res.status(500).json({
      error: 'Failed to update phrase',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/games/:gameCode/phrases/:phraseId - Delete a specific phrase
 */
export async function deletePhrase(req: Request, res: Response): Promise<void>
{
  try
  {
    const { gameCode, phraseId } = req.params;
    const { playerId } = req.query;

    // Validate parameters
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    if (!phraseId || typeof phraseId !== 'string')
    {
      res.status(400).json({ error: 'Invalid phrase ID' });
      return;
    }

    if (!playerId || typeof playerId !== 'string')
    {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Verify game exists and is in correct state
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game)
      {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'setup')
      {
        res
          .status(400)
          .json({ error: 'Cannot delete phrases after game has started' });
        return;
      }

      // Verify phrase exists
      const phrase = await findById<Phrase>('phrases', phraseId, transaction);
      if (!phrase)
      {
        res.status(404).json({ error: 'Phrase not found' });
        return;
      }

      if (phrase.game_id !== gameCode)
      {
        res.status(400).json({ error: 'Phrase does not belong to this game' });
        return;
      }

      // Verify authorization (player owns phrase OR player is host)
      const player = await findById<Player>('players', playerId, transaction);
      if (!player || player.game_id !== gameCode)
      {
        res.status(403).json({ error: 'Player not found in this game' });
        return;
      }

      const canDelete = phrase.player_id === playerId || player.id === game.host_player_id;
      if (!canDelete)
      {
        res.status(403).json({
          error: 'You can only delete your own phrases, or phrases as the game host',
        });
        return;
      }

      // Delete the phrase using direct SQL deletion
      await transaction.run('DELETE FROM phrases WHERE id = ?', [phraseId]);

      res.status(200).json({ message: 'Phrase deleted successfully' });
    });
  }
  catch (error)
  {
    console.error('Error deleting phrase:', error);
    res.status(500).json({
      error: 'Failed to delete phrase',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

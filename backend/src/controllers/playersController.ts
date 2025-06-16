import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TransactionConnection, withTransaction } from '../db/connection';
import { Game, Player, Team } from '../db/schema';
import { findById, insert, select, update } from '../db/utils';
import { JoinGameRequest, JoinGameResponse, PlayerInfo, PlayersResponse } from '../types/rest-api';
import { assignPlayerToTeam } from '../utils/teamUtils';
import { validatePlayerName } from '../utils/validators';

/**
 * POST /api/games/:gameCode/join - Join an existing game
 */
export async function joinGame(req: Request, res: Response): Promise<void>
{
  try
  {
    const { gameCode } = req.params;
    const { playerName, teamId }: JoinGameRequest = req.body;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    } // Validate player name
    const playerNameValidation = validatePlayerName(playerName);
    if (!playerNameValidation.isValid)
    {
      res.status(400).json({ error: playerNameValidation.error });
      return;
    } // Validate teamId if provided
    if (
      teamId !== undefined &&
      (typeof teamId !== 'string' || teamId.trim().length === 0)
    )
    {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    const trimmedPlayerName = playerName.trim();

    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Check if game exists and is joinable
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
          .json({ error: 'Game is no longer accepting new players' });
        return;
      }

      // Check if player name already exists in this game
      const existingPlayer = await select<Player>(
        'players',
        {
          where: [
            { field: 'game_id', operator: '=', value: gameCode },
            { field: 'name', operator: '=', value: trimmedPlayerName },
          ],
        },
        transaction,
      );

      let player: Player;
      let teamInfo: { teamId?: string; teamName?: string; } = {};

      // If player already exists in the game then the player may be reconnecting
      if (existingPlayer.length > 0)
      {
        // Player reconnecting
        player = existingPlayer[0]!;

        // Update connection status
        await update(
          'players',
          { is_connected: true, last_seen_at: new Date().toISOString() },
          [{ field: 'id', operator: '=', value: player.id }],
          transaction,
        );

        // Get team info if assigned
        if (player.team_id)
        {
          const team = await findById<Team>(
            'teams',
            player.team_id,
            transaction,
          );
          if (team)
          {
            teamInfo = { teamId: team.id, teamName: team.name };
          }
        }
      }
      // No existing player found
      else
      {
        // New player joining
        const playerId = uuidv4();

        player = {
          id: playerId,
          game_id: gameCode,
          name: trimmedPlayerName,
          team_id: null as any, // Will be set by assignPlayerToTeam
          is_connected: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        };

        // Insert player first, then assign to team
        await insert('players', player, transaction);

        try
        {
          // Assign to team (with optional preferred team)
          const assignedTeamId = await assignPlayerToTeam(
            gameCode,
            playerId,
            teamId,
            transaction,
          );

          if (assignedTeamId)
          {
            const team = await findById<Team>(
              'teams',
              assignedTeamId,
              transaction,
            );
            if (team)
            {
              teamInfo = { teamId: team.id, teamName: team.name };
            }
            // Update the player object for consistency
            player.team_id = assignedTeamId;
          }
          else if (teamId)
          {
            // If a specific team was requested but assignment failed, this is an error
            res.status(400).json({ error: 'No teams available to join' });
            return;
          }
        }
        catch (teamError)
        {
          // Handle specific team assignment errors
          if (
            teamError instanceof Error &&
            teamError.message.includes('does not exist in game')
          )
          {
            res.status(400).json({ error: 'Specified team does not exist' });
            return;
          }
          throw teamError; // Re-throw if it's not a team-specific error
        }
      }

      // Get current player count
      const allPlayers = await select<Player>(
        'players',
        {
          where: [{ field: 'game_id', operator: '=', value: gameCode }],
        },
        transaction,
      );

      const response: JoinGameResponse = {
        playerId: player.id,
        playerName: player.name,
        teamId: teamInfo.teamId,
        teamName: teamInfo.teamName,
        gameInfo: {
          id: game.id,
          name: game.name,
          status: game.status,
          sub_status: game.sub_status,
          playerCount: allPlayers.length,
          teamCount: game.team_count,
          phrasesPerPlayer: game.phrases_per_player,
          timerDuration: game.timer_duration,
        },
      };

      res.status(200).json(response);
    });
  }
  catch (error)
  {
    console.error('Error joining game:', error);
    res.status(500).json({
      error: 'Failed to join game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/games/:gameCode/players - Get list of players in game
 */
export async function getGamePlayers(
  req: Request,
  res: Response,
): Promise<void>
{
  try
  {
    const { gameCode } = req.params;

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

    // Get players with team information
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
      orderBy: [{ field: 'created_at', direction: 'ASC' }],
    });

    const teams = await select<Team>('teams', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
    });

    // Create a map for quick team lookup
    const teamMap = new Map(teams.map(team => [team.id, team]));

    // Map players to response format
    const playerInfos: PlayerInfo[] = players.map(player => ({
      id: player.id,
      name: player.name,
      teamId: player.team_id,
      teamName: player.team_id ? teamMap.get(player.team_id)?.name : undefined,
      isConnected: Boolean(player.is_connected),
      joinedAt: player.created_at,
    }));

    const response: PlayersResponse = {
      players: playerInfos,
      totalCount: players.length,
    };

    res.status(200).json(response);
  }
  catch (error)
  {
    console.error('Error getting game players:', error);
    res.status(500).json({
      error: 'Failed to get game players',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

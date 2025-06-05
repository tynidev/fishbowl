import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Game, Player, Team } from '../db/schema';
import {
  insert,
  select,
  findById,
  update,
} from '../db/utils';
import { withTransaction, TransactionConnection } from '../db/connection';
import {
  JoinGameRequest,
  JoinGameResponse,
  PlayerInfo,
  PlayersResponse,
} from '../types/rest-api';
import { validatePlayerName } from '../utils/validators';
import { assignPlayerToTeam } from '../utils/teamUtils';

/**
 * POST /api/games/:gameCode/join - Join an existing game
 */
export async function joinGame(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;
    const { playerName }: JoinGameRequest = req.body;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Validate player name
    const playerNameValidation = validatePlayerName(playerName);
    if (!playerNameValidation.isValid) {
      res.status(400).json({ error: playerNameValidation.error });
      return;
    }

    const trimmedPlayerName = playerName.trim();

    await withTransaction(async (transaction: TransactionConnection) => {
      // Check if game exists and is joinable
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'waiting') {
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
        transaction
      );

      let player: Player;
      let teamInfo: { teamId?: string; teamName?: string } = {};
      if (existingPlayer.length > 0) {
        // Player reconnecting
        player = existingPlayer[0]!;

        // Update connection status
        await update(
          'players',
          { is_connected: true, last_seen_at: new Date().toISOString() },
          [{ field: 'id', operator: '=', value: player.id }],
          transaction
        );

        // Get team info if assigned
        if (player.team_id) {
          const team = await findById<Team>(
            'teams',
            player.team_id,
            transaction
          );
          if (team) {
            teamInfo = { teamId: team.id, teamName: team.name };
          }
        }
      } else {
        // New player joining
        const playerId = uuidv4();

        // Assign to team first
        const assignedTeamId = await assignPlayerToTeam(gameCode, transaction);

        player = {
          id: playerId,
          game_id: gameCode,
          name: trimmedPlayerName,
          team_id: assignedTeamId || (null as any),
          is_connected: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        };

        await insert('players', player, transaction);

        if (assignedTeamId) {
          const team = await findById<Team>(
            'teams',
            assignedTeamId,
            transaction
          );
          if (team) {
            teamInfo = { teamId: team.id, teamName: team.name };
          }
        }
      }

      // Get current player count
      const allPlayers = await select<Player>(
        'players',
        {
          where: [{ field: 'game_id', operator: '=', value: gameCode }],
        },
        transaction
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
          playerCount: allPlayers.length,
          teamCount: game.team_count,
          phrasesPerPlayer: game.phrases_per_player,
          timerDuration: game.timer_duration,
        },
      };

      res.status(200).json(response);
    });
  } catch (error) {
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
export async function getGamePlayers(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;

    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Verify game exists
    const game = await findById<Game>('games', gameCode);
    if (!game) {
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

    const teamMap = new Map(teams.map(team => [team.id, team]));

    const playerInfos: PlayerInfo[] = players.map(player => ({
      id: player.id,
      name: player.name,
      teamId: player.team_id,
      teamName: player.team_id ? teamMap.get(player.team_id)?.name : undefined,
      isConnected: player.is_connected,
      joinedAt: player.created_at,
    }));

    const response: PlayersResponse = {
      players: playerInfos,
      totalCount: players.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting game players:', error);
    res.status(500).json({
      error: 'Failed to get game players',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

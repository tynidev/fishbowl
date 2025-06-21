import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import { GameInfoResponse, CreateGameRequest, UpdateConfigRequest, StartRoundResponse } from '../types/rest-api';
import { Game, Player, Team, TurnOrder, Turn, Phrase } from '../db/schema';
import { withTransaction } from '../db/connection';
import { findById, insert, select, update, exists } from '../db/utils';
import { validateGameConfig, validatePlayerName } from '../utils/validators';
import { TransactionConnection } from '../db/connection';
import { broadcastRoundStarted, RoundStartedData, broadcastGameStarted } from '../sockets/SOCKET-API';
import { generateGameCode } from '../utils/codeGenerator';
import { createDefaultTeams } from '../utils/teamUtils';
import { getRandomPlayerFromTurnOrder, getNextPlayerInTurnOrder } from '../utils/turnUtils';

/**
 * POST /api/games - Create a new game
 */
export async function createGame(req: Request, res: Response): Promise<void>
{
  try
  {
    const {
      name,
      hostPlayerName,
      teamCount = 2,
      phrasesPerPlayer = 5,
      timerDuration = 60,
    }: CreateGameRequest = req.body; // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0)
    {
      res.status(400).json({ error: 'Game name is required' });
      return;
    }

    // Validate game name length
    if (name.trim().length > 100)
    {
      res
        .status(400)
        .json({ error: 'Game name must be 100 characters or less' });
      return;
    }

    // Validate host player name
    const playerNameValidation = validatePlayerName(hostPlayerName);
    if (!playerNameValidation.isValid)
    {
      res.status(400).json({ error: playerNameValidation.error });
      return;
    }

    // Validate game configuration
    const configValidation = validateGameConfig({
      teamCount,
      phrasesPerPlayer,
      timerDuration,
    });
    if (!configValidation.isValid)
    {
      res.status(400).json({
        error: 'Invalid game configuration',
        details: configValidation.errors,
      });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Generate unique game code
      let gameCode: string;
      let codeExists = true;
      let attempts = 0;
      const maxAttempts = 10;

      do
      {
        gameCode = generateGameCode();
        codeExists = await exists(
          'games',
          [{ field: 'id', operator: '=', value: gameCode }],
          transaction,
        );
        attempts++;
      }
      while (codeExists && attempts < maxAttempts);

      if (codeExists)
      {
        throw new Error('Failed to generate unique game code');
      }

      // Create host player
      const hostPlayerId = uuidv4();
      const hostPlayer: Omit<
        Player,
        'created_at' | 'updated_at' | 'last_seen_at'
      > = {
        id: hostPlayerId,
        game_id: gameCode,
        name: hostPlayerName.trim(),
        team_id: null as any,
        is_connected: true,
      };

      // Create game
      const game: Omit<Game, 'created_at' | 'updated_at'> = {
        id: gameCode,
        name: name.trim(),
        status: 'setup',
        sub_status: 'waiting_for_players',
        host_player_id: hostPlayerId,
        team_count: teamCount,
        phrases_per_player: phrasesPerPlayer,
        timer_duration: timerDuration,
        current_round: 1,
        current_team: 1,
        current_turn_id: null as any,
        started_at: null as any,
        finished_at: null as any,
      };

      await insert('games', game, transaction);

      // Create default teams
      const teams = await createDefaultTeams(gameCode, teamCount, transaction);

      // Assign host player to first team and insert
      if (teams.length > 0 && teams[0])
      {
        const updatedHostPlayer = { ...hostPlayer, team_id: teams[0].id };
        await insert('players', updatedHostPlayer, transaction);
      }
      else
      {
        await insert('players', hostPlayer, transaction);
      }

      // Get updated game info for response
      const updatedGameInfo = await findById<Game>(
        'games',
        gameCode,
        transaction,
      );

      // Prepare and send response
      const response: GameInfoResponse = {
        id: gameCode,
        name: updatedGameInfo!.name,
        status: updatedGameInfo!.status,
        sub_status: updatedGameInfo!.sub_status,
        hostPlayerId: updatedGameInfo!.host_player_id,
        teamCount: updatedGameInfo!.team_count,
        phrasesPerPlayer: updatedGameInfo!.phrases_per_player,
        timerDuration: updatedGameInfo!.timer_duration,
        currentRound: updatedGameInfo!.current_round,
        currentTeam: updatedGameInfo!.current_team,
        playerCount: 1, // Only host player at creation
        createdAt: updatedGameInfo!.created_at,
        startedAt: updatedGameInfo!.started_at,
      };

      res.status(201).json(response);
    });
  }
  catch (error)
  {
    console.error('Error creating game:', error);
    res.status(500).json({
      error: 'Failed to create game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/games/:gameCode - Get game information
 */
export async function getGameInfo(req: Request, res: Response): Promise<void>
{
  try
  {
    const { gameCode } = req.params;

    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    const game = await findById<Game>('games', gameCode);
    if (!game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get player count
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
    });

    const response: GameInfoResponse = {
      id: game.id,
      name: game.name,
      status: game.status,
      sub_status: game.sub_status,
      hostPlayerId: game.host_player_id,
      teamCount: game.team_count,
      phrasesPerPlayer: game.phrases_per_player,
      timerDuration: game.timer_duration,
      currentRound: game.current_round,
      currentTeam: game.current_team,
      playerCount: players.length,
      createdAt: game.created_at,
      startedAt: game.started_at,
    };

    res.status(200).json(response);
  }
  catch (error)
  {
    console.error('Error getting game info:', error);
    res.status(500).json({
      error: 'Failed to get game information',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/games/:gameCode/config - Update game configuration
 */
export async function updateGameConfig(
  req: Request,
  res: Response,
): Promise<void>
{
  try
  {
    const { gameCode } = req.params;
    const { teamCount, phrasesPerPlayer, timerDuration }: UpdateConfigRequest = req.body;
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Validate that at least one configuration field is provided
    if (
      teamCount === undefined &&
      phrasesPerPlayer === undefined &&
      timerDuration === undefined
    )
    {
      res.status(400).json({
        error: 'At least one configuration field must be provided (teamCount, phrasesPerPlayer, or timerDuration)',
      });
      return;
    }

    // Validate configuration updates
    const configToValidate: {
      teamCount?: number;
      phrasesPerPlayer?: number;
      timerDuration?: number;
    } = {};

    if (teamCount !== undefined) configToValidate.teamCount = teamCount;
    if (phrasesPerPlayer !== undefined)
    {
      configToValidate.phrasesPerPlayer = phrasesPerPlayer;
    }
    if (timerDuration !== undefined)
    {
      configToValidate.timerDuration = timerDuration;
    }

    const configValidation = validateGameConfig(configToValidate);
    if (!configValidation.isValid)
    {
      res.status(400).json({
        error: 'Invalid configuration',
        details: configValidation.errors,
      });
      return;
    }
    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Check if game exists and is configurable
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game)
      {
        throw new Error('GAME_NOT_FOUND');
      }

      if (game.status !== 'setup')
      {
        throw new Error('GAME_ALREADY_STARTED');
      }

      // Prepare update data
      const updateData: Partial<Game> = {};
      if (teamCount !== undefined) updateData.team_count = teamCount;
      if (phrasesPerPlayer !== undefined)
      {
        updateData.phrases_per_player = phrasesPerPlayer;
      }
      if (timerDuration !== undefined)
      {
        updateData.timer_duration = timerDuration; // Update game configuration
      }
      if (Object.keys(updateData).length > 0)
      {
        await update(
          'games',
          updateData,
          [{ field: 'id', operator: '=', value: gameCode }],
          transaction,
        ); // If team count changed, handle teams intelligently
        if (teamCount !== undefined && teamCount !== game.team_count)
        {
          // Implementation for team management would go here
          // For now, we'll keep it simple and let teamUtils handle this
          // This is a complex operation that involves team creation/deletion
          // and player reassignment, which is already implemented in the original code
        }
      }

      // Return updated game info
      const updatedGame = await findById<Game>('games', gameCode, transaction);
      const players = await select<Player>(
        'players',
        {
          where: [{ field: 'game_id', operator: '=', value: gameCode }],
        },
        transaction,
      );

      const response: GameInfoResponse = {
        id: updatedGame!.id,
        name: updatedGame!.name,
        status: updatedGame!.status,
        sub_status: updatedGame!.sub_status,
        hostPlayerId: updatedGame!.host_player_id,
        teamCount: updatedGame!.team_count,
        phrasesPerPlayer: updatedGame!.phrases_per_player,
        timerDuration: updatedGame!.timer_duration,
        currentRound: updatedGame!.current_round,
        currentTeam: updatedGame!.current_team,
        playerCount: players.length,
        createdAt: updatedGame!.created_at,
        startedAt: updatedGame!.started_at,
      };

      res.status(200).json(response);
    });
  }
  catch (error)
  {
    console.error('Error updating game config:', error);

    if (error instanceof Error)
    {
      if (error.message === 'GAME_NOT_FOUND')
      {
        res.status(404).json({ error: 'Game not found' });
        return;
      }
      if (error.message === 'GAME_ALREADY_STARTED')
      {
        res.status(400).json({
          error: 'Cannot update configuration after game has started',
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Failed to update game configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/games/:gameCode/start - Start the game
 */
export async function startGame(req: Request, res: Response): Promise<void>
{
  try
  {
    const { gameCode } = req.params;

    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Check if game exists
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game)
      {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'setup')
      {
        res.status(400).json({
          error: 'Game has already started or is not in a startable state',
        });
        return;
      }

      // Get Teams and Players for validation
      const teams = await select<Team>('teams', {
        where: [{ field: 'game_id', operator: '=', value: gameCode }],
      });
      const players = await select<Player>('players', {
        where: [{ field: 'game_id', operator: '=', value: gameCode }],
      });
      const phrases = await select<Phrase>('phrases', {
        where: [{ field: 'game_id', operator: '=', value: gameCode }],
      });

      // Validate team count
      if (!teams || teams.length < game.team_count)
      {
        res.status(400).json({
          error: 'Not enough teams to start the game',
        });
        return;
      }

      // Validate there are at least 2 * game.team_count players
      if (!players || players.length < 2 * game.team_count)
      {
        res.status(400).json({
          error: `Not enough players to start the game. Required: ${2 * game.team_count}, Found: ${players.length}`,
        });
        return;
      }

      // Validate phrases submitted
      if (
        !phrases ||
        phrases.length < players.length * game.phrases_per_player
      )
      {
        res.status(400).json({
          error: `Not enough phrases submitted. Required: ${
            players.length * game.phrases_per_player
          }, Found: ${phrases.length}`,
        });
        return;
      }

      // For all players, check if they have a team assigned and have submitted the required number of phrases
      for (const player of players)
      {
        // Check if player has a team assigned
        if (!player.team_id)
        {
          res.status(400).json({
            error: `Player ${player.name} is not assigned to a team`,
          });
          return;
        }

        // Check if player has submitted the required number of phrases
        const playerPhrases = phrases.filter(
          phrase => phrase.player_id === player.id,
        );
        if (playerPhrases.length < game.phrases_per_player)
        {
          res.status(400).json({
            error: `Player ${player.name} must submit ${game.phrases_per_player} phrases`,
          });
          return;
        }
      }

      // Update game status to 'playing' and set start time
      const startTime = new Date(); // Current time as start time
      const updatedGame: Partial<Game> = {
        status: 'playing',
        sub_status: 'round_intro',
        started_at: startTime.toISOString(),
      };

      await update(
        'games',
        updatedGame,
        [{ field: 'id', operator: '=', value: gameCode }],
        transaction,
      );

      // Group players by team for draft
      const playersByTeam = new Map<string, Player[]>();
      for (const player of players)
      {
        if (!player.team_id) continue;
        if (!playersByTeam.has(player.team_id))
        {
          playersByTeam.set(player.team_id, []);
        }
        playersByTeam.get(player.team_id)!.push(player);
      }

      // Shuffle players within each team
      for (const [teamId, teamPlayers] of playersByTeam.entries())
      {
        teamPlayers.sort(() => Math.random() - 0.5);
        playersByTeam.set(teamId, teamPlayers);
      }

      // Shuffle team order
      const teamIds = Array.from(playersByTeam.keys()).sort(
        () => Math.random() - 0.5,
      );

      // Build draft order
      const playerOrder: Player[] = [];
      const maxPlayersPerTeam = Math.max(
        ...Array.from(playersByTeam.values()).map(team => team.length),
      );

      for (
        let playerIndex = 0;
        playerIndex < maxPlayersPerTeam;
        playerIndex++
      )
      {
        for (const teamId of teamIds)
        {
          const teamPlayers = playersByTeam.get(teamId);
          if (teamPlayers && teamPlayers[playerIndex])
          {
            playerOrder.push(teamPlayers[playerIndex]!);
          }
        }
      }

      // Create TurnOrder records in a circular linked list
      for (let i = 0; i < playerOrder.length; i++)
      {
        const currentPlayer = playerOrder[i];
        const nextPlayer = playerOrder[(i + 1) % playerOrder.length];
        const prevPlayer = playerOrder[(i - 1 + playerOrder.length) % playerOrder.length];

        const turnOrder: Omit<TurnOrder, 'created_at' | 'updated_at'> = {
          id: uuidv4(),
          game_id: gameCode,
          player_id: currentPlayer!.id,
          team_id: currentPlayer!.team_id!,
          next_player_id: nextPlayer!.id,
          prev_player_id: prevPlayer!.id,
        };

        await insert('turn_order', turnOrder, transaction);
      }

      // Get updated game info for response
      const updatedGameInfo = await findById<Game>(
        'games',
        gameCode,
        transaction,
      );

      // Prepare and send response
      const response: GameInfoResponse = {
        id: gameCode,
        name: updatedGameInfo!.name,
        status: updatedGameInfo!.status,
        sub_status: updatedGameInfo!.sub_status,
        hostPlayerId: updatedGameInfo!.host_player_id,
        teamCount: updatedGameInfo!.team_count,
        phrasesPerPlayer: updatedGameInfo!.phrases_per_player,
        timerDuration: updatedGameInfo!.timer_duration,
        currentRound: updatedGameInfo!.current_round,
        currentTeam: updatedGameInfo!.current_team,
        playerCount: players.length,
        createdAt: updatedGameInfo!.created_at,
        startedAt: updatedGameInfo!.started_at,
      };

      // Broadcast game started event to all connected clients
      if (socketServer)
      {
        const gameStartedData = {
          gameCode: game.id,
          startedAt: startTime,
        };
        broadcastGameStarted(socketServer, gameStartedData);
      }

      res.status(200).json(response);
    });
  }
  catch (error)
  {
    console.error('Error starting game:', error);
    res.status(500).json({
      error: 'Failed to start game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/games/:gameCode/rounds/start - Start a new round
 */
export async function startRound(req: Request, res: Response): Promise<void>
{
  try
  {
    const { gameCode } = req.params;

    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6)
    {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) =>
    {
      // Retrieve game information
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game)
      {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      // Check if game is in the correct state to start a round
      if (game.status !== 'playing' || game.sub_status !== 'round_intro')
      {
        res.status(400).json({
          error: 'Game is not in the correct state to start a round',
          status: game.status,
          subStatus: game.sub_status,
        });
        return;
      }

      // Determine the current round and get round name
      const roundNames = ['Taboo', 'Charades', 'One Word'];
      const roundName = roundNames[game.current_round - 1] || 'Unknown';

      // Get the next player in the turn order OR first player if no current turn
      const nextPlayerId = await getNextPlayerInTurnOrder(gameCode, game.current_turn_id, transaction);
      
      if (!nextPlayerId)
      {
        res.status(500).json({ error: 'Failed to determine next player for the round' });
        return;
      }

      // Get player information
      const player = await findById<Player>('players', nextPlayerId, transaction);
      if (!player)
      {
        res.status(500).json({ error: 'Player not found' });
        return;
      }

      // Create the first turn of the round
      const turnId = uuidv4();
      const startTime = new Date().toISOString();
      
      const turn = {
        id: turnId,
        game_id: gameCode,
        round: game.current_round,
        team_id: player.team_id,
        player_id: player.id,
        start_time: startTime,
        duration: 0,
        phrases_guessed: 0,
        phrases_skipped: 0,
        points_scored: 0,
        is_complete: false,
      };

      await insert('turns', turn, transaction);

      // Reset all phrase statuses for the new round
      await update(
        'phrases',
        { status: 'active' },
        [
          { field: 'game_id', operator: '=', value: gameCode },
        ],
        transaction
      );

      // Update game state with the new turn
      await update(
        'games',
        {
          current_turn_id: turnId,
          sub_status: 'turn_starting',
          updated_at: startTime,
        },
        [{ field: 'id', operator: '=', value: gameCode }],
        transaction
      );

      // Prepare response
      const response: StartRoundResponse = {
        round: game.current_round,
        roundName,
        currentTurnId: turnId,
        currentPlayer: {
          id: player.id,
          teamId: player.team_id || '',
        },
        startedAt: startTime,
      };

      // Send response
      res.status(200).json(response);

      // Broadcast round started event via Socket.IO
      if (socketServer)
      {
        const roundStartData: RoundStartedData = {
          gameCode,
          round: game.current_round,
          roundName,
          startedAt: new Date(startTime),
        };
        
        await broadcastRoundStarted(socketServer, roundStartData);
      }
    });
  }
  catch (error)
  {
    console.error('Error starting round:', error);
    res.status(500).json({
      error: 'Failed to start round',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Store reference to socket server (will be set when server starts)
let socketServer: SocketIOServer | null = null;

export function setSocketServer(server: SocketIOServer): void
{
  socketServer = server;
}

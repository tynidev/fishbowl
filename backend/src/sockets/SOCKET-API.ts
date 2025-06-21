import { Server as SocketIOServer, Socket } from 'socket.io';
import { withTransaction } from '../db/connection';
import { Game, Player, Team } from '../db/schema';
import { findById, select, update } from '../db/utils';
import {
  cleanupStaleSessions,
  createOrUpdateDeviceSession,
  deactivateDeviceSessionBySocket,
  generateDeviceId,
  getDeviceSession,
  getDeviceSessionBySocket,
  updateLastSeen,
} from './deviceSessionManager';

// ==================== Socket Event Interfaces ====================

export interface JoinGameData
{
  gameCode: string;
  playerId: string;
  playerName: string;
  deviceId: string;
}

export interface LeaveGameData
{
  gameCode: string;
  playerId: string;
}

export interface TeamAssignmentData
{
  gameCode: string;
  playerId: string;
  teamId: string;
}

export interface GameStartedData
{
  gameCode: string;
  startedAt: Date;
}

// ==================== Socket Connection Management ====================

interface ConnectedPlayer
{
  socketId: string;
  playerId: string;
  gameCode: string;
  playerName: string;
  connectedAt: Date;
}

// Store active socket connections
const connectedPlayers = new Map<string, ConnectedPlayer>(); // socketId -> player info
const playerSockets = new Map<string, string>(); // playerId -> socketId

// ==================== Event Handlers ====================

/**
 * Handle player joining a game room
 *
 * This is triggered when a player connects to a game and wants to receive
 * real-time updates. This typically happens after they've already joined
 * the game via the REST API.
 *
 * Key characteristics:
 * - Initiated by client via 'gameroom:join' event
 * - Requires gameCode, playerId, and playerName
 * - Validates that the player exists in the game
 * - Handles reconnection by disconnecting any existing socket for the same player
 * - Updates player's connection status to true in database
 * - Joins the Socket.IO room for the game
 * - Sends current game state to the newly connected player
 *
 * Emits:
 * - 'gameroom:joined' - To the connecting player confirming join
 * - 'gameroom:player:joined' - To all players in game notifying of new connection
 * - 'game:state' - To the connecting player with full game state
 * - 'error' - If validation fails or any error occurs
 */
export async function handleJoinGameRoom(
  io: SocketIOServer,
  socket: Socket,
  data: JoinGameData,
): Promise<void>
{
  try
  {
    const { gameCode, playerId, playerName, deviceId } = data;

    // Validate input
    if (!gameCode || !playerId || !playerName || !deviceId)
    {
      socket.emit('error', {
        message: 'Missing required fields: gameCode, playerId, playerName, deviceId',
      });
      return;
    }

    await withTransaction(async transaction =>
    {
      // Verify game exists
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game)
      {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Verify player exists in game
      const player = await findById<Player>('players', playerId, transaction);
      if (!player || player.game_id !== gameCode)
      {
        // Player should have already joined the game via REST API
        socket.emit('error', {
          message: 'Player not found in this game. Make sure to join via REST API first.',
        });
        return;
      }

      // Create or update device session
      await createOrUpdateDeviceSession(
        transaction,
        deviceId,
        socket.id,
        playerId,
        gameCode,
      );

      // Check if player is already connected on another socket
      // if they are, disconnect the old socket
      const existingSocketId = playerSockets.get(playerId);
      if (existingSocketId && existingSocketId !== socket.id)
      {
        // Disconnect the old socket
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket)
        {
          // Check if this is a reconnection from the same device
          const existingSession = await getDeviceSessionBySocket(existingSocketId);
          const isReconnection = existingSession && existingSession.device_id === deviceId;

          existingSocket.emit('connection:replaced', {
            message: isReconnection ?
              'You have reconnected from the same device' :
              'You have connected from another device',
            isReconnection,
          });
          existingSocket.disconnect();

          // Deactivate the old session
          await deactivateDeviceSessionBySocket(transaction, existingSocketId);
        }
        // Clean up old connection data
        connectedPlayers.delete(existingSocketId);
      }

      // Update player connection status in database
      await update(
        'players',
        { is_connected: true },
        [{ field: 'id', operator: '=', value: playerId }],
        transaction,
      );

      // Store connection info
      const playerConnection: ConnectedPlayer = {
        socketId: socket.id,
        playerId,
        gameCode,
        playerName,
        connectedAt: new Date(),
      };
      connectedPlayers.set(socket.id, playerConnection);
      playerSockets.set(playerId, socket.id);

      // Join game room
      socket.join(gameCode);

      // Notify the player that they have joined the game
      socket.emit('gameroom:joined', {
        gameCode,
        playerId,
        playerName,
        connectedAt: playerConnection.connectedAt,
      });

      // Notify other players in the game that this player has connected
      io.to(gameCode).emit('gameroom:player:joined', {
        playerId,
        playerName,
        connectedAt: playerConnection.connectedAt,
      });

      // Send current game state to the newly connected player
      await sendGameStateToPlayer(socket, gameCode, transaction);

      console.log(
        `Player ${playerName} (${playerId}) joined game ${gameCode} on socket ${socket.id}`,
      );
    });
  }
  catch (error)
  {
    console.error('Error in handleJoinGame:', error);
    socket.emit('error', {
      message: 'Failed to join game',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle player leaving a game room
 *
 * Triggered when a player intentionally leaves the game (e.g., "Leave Game" button).
 *
 * Key characteristics:
 * - Initiated by client via 'gameroom:leave' event
 * - Requires gameCode and playerId
 * - Updates player's connection status to false in database
 * - Removes player from Socket.IO room
 * - Cleans up connection tracking data
 * - Validates that the player is leaving the correct game
 *
 * Emits:
 * - 'gameroom:player:left' - To all remaining players in game
 * - 'error' - If validation fails or game code mismatch
 */
export async function handleLeaveGameRoom(
  io: SocketIOServer,
  socket: Socket,
  data: LeaveGameData,
): Promise<void>
{
  try
  {
    const { gameCode, playerId } = data;

    await withTransaction(async transaction =>
    {
      // Update player connection status in database
      if (playerId)
      {
        await update(
          'players',
          { is_connected: false },
          [{ field: 'id', operator: '=', value: playerId }],
          transaction,
        );
      }

      const playerConnection = connectedPlayers.get(socket.id);

      // Validate player connection exists
      if (!playerConnection)
      {
        return;
      }

      // Validate game code matches the game the player is connected to
      if (playerConnection.gameCode !== gameCode)
      {
        socket.emit('error', {
          message: 'Game code mismatch - cannot leave a different game',
        });
        return;
      }

      // Remove player from connected players
      connectedPlayers.delete(socket.id);

      // Delete the player's socket from playerSockets
      playerSockets.delete(playerConnection.playerId);

      // Leave game room
      socket.leave(gameCode);

      // Notify other players
      io.to(gameCode).emit('gameroom:player:left', {
        playerId: playerConnection.playerId,
        playerName: playerConnection.playerName,
        disconnectedAt: new Date(),
      });

      console.log(
        `Player ${playerConnection.playerName} left game ${gameCode}`,
      );
    });
  }
  catch (error)
  {
    console.error('Error in handleLeaveGame:', error);
    socket.emit('error', {
      message: 'Failed to leave game',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle socket disconnection (cleanup)
 *
 * This is triggered automatically by Socket.IO when a client's connection
 * is lost for any reason (network issues, browser closed, app crash, etc.).
 *
 * Key characteristics:
 * - Automatically called by Socket.IO on connection loss
 * - Only has access to data stored in memory (no client data provided)
 * - Cannot send responses to client (they're already disconnected)
 * - Includes disconnect reason (e.g., "transport close", "client namespace disconnect")
 * - Used for handling unexpected connection losses and cleanup
 *
 * Common reasons:
 * - "transport close" - Network connection lost
 * - "client namespace disconnect" - Client called socket.disconnect()
 * - "ping timeout" - Client stopped responding to heartbeat
 * - "transport error" - WebSocket error occurred
 *
 * Emits:
 * - 'gameroom:player:left' - To all remaining players in game notifying of disconnection
 *
 * Note: Cannot emit to the disconnecting player as they are no longer connected
 */
export async function handleDisconnect(
  io: SocketIOServer,
  socket: Socket,
  reason: string,
): Promise<void>
{
  try
  {
    const playerConnection = connectedPlayers.get(socket.id);

    if (playerConnection)
    {
      await withTransaction(async transaction =>
      {
        // Deactivate device session
        await deactivateDeviceSessionBySocket(transaction, socket.id);

        // Update player connection status in database
        await update(
          'players',
          { is_connected: false },
          [{ field: 'id', operator: '=', value: playerConnection.playerId }],
          transaction,
        );

        // Clean up tracking
        connectedPlayers.delete(socket.id);
        playerSockets.delete(playerConnection.playerId);

        // Notify other players in the game
        io.to(playerConnection.gameCode).emit('gameroom:player:left', {
          playerId: playerConnection.playerId,
          playerName: playerConnection.playerName,
          disconnectedAt: new Date(),
          reason,
        });

        console.log(
          `Player ${playerConnection.playerName} disconnected from game ${playerConnection.gameCode} (${reason})`,
        );
      });
    }
  }
  catch (error)
  {
    console.error('Error in handleDisconnect:', error);
  }
}

// ==================== Broadcast Functions ====================

/**
 * Broadcast complete game state to all players in a game
 */
export async function broadcastGameState(
  io: SocketIOServer,
  game: Game,
  players: Player[],
): Promise<void> {
  try {
    if (!game || !players) return;

    // Broadcast comprehensive game state to all players
    io.to(game.id).emit('game:state', {
      game: {
        id: game.id,
        name: game.name,
        status: game.status,
        hostPlayerId: game.host_player_id,
        teamCount: game.team_count,
        phrasesPerPlayer: game.phrases_per_player,
        timerDuration: game.timer_duration,
        currentRound: game.current_round,
        currentTeam: game.current_team,
        createdAt: game.created_at,
        startedAt: game.started_at,
      },
      players: players.map(player => ({
        id: player.id,
        name: player.name,
        teamId: player.team_id,
        isConnected: Boolean(player.is_connected),
        joinedAt: player.created_at,
      })),
      gameId: game.id,
      updatedAt: new Date(),
    });

    console.log(`Broadcasting game state for game ${game.id}`);

  }
  catch (error) {
    console.error('Error broadcasting game state update:', error);
  }
}

/**
 * Broadcast game started event to all players in a game
 */
export async function broadcastGameStarted(
  io: SocketIOServer,
  data: GameStartedData,
): Promise<void>
{
  try
  {
    io.to(data.gameCode).emit('game:started', data);
    console.log(`Broadcasting game started for game ${data.gameCode}`);
  }
  catch (error)
  {
    console.error('Error broadcasting game started:', error);
  }
}

// ==================== Utility Functions ====================

/**
 * Send current game state to a specific player
 */
async function sendGameStateToPlayer(
  socket: Socket,
  gameCode: string,
  transaction: any,
): Promise<void>
{
  try
  {
    // Get current game state
    const game = await findById<Game>('games', gameCode, transaction);
    if (!game) return;

    // Get all players in the game
    const players = await select<Player>(
      'players',
      {
        where: [{ field: 'game_id', operator: '=', value: gameCode }],
      },
      transaction,
    );

    // Send comprehensive game state
    socket.emit('game:state', {
      game: {
        id: game.id,
        name: game.name,
        status: game.status,
        hostPlayerId: game.host_player_id,
        teamCount: game.team_count,
        phrasesPerPlayer: game.phrases_per_player,
        timerDuration: game.timer_duration,
        currentRound: game.current_round,
        currentTeam: game.current_team,
        createdAt: game.created_at,
        startedAt: game.started_at,
      },
      players: players.map(player => ({
        id: player.id,
        name: player.name,
        teamId: player.team_id,
        isConnected: Boolean(player.is_connected),
        joinedAt: player.created_at,
      })),
    });
  }
  catch (error)
  {
    console.error('Error sending game state to player:', error);
  }
}

/**
 * Register all Socket.IO event handlers
 */
export function registerSocketHandlers(
  io: SocketIOServer,
  cleanup: boolean = true,
): void
{
  io.on('connection', (socket: Socket) =>
  {
    console.log(`Socket connected: ${socket.id}`);

    // Game room management
    socket.on('gameroom:join', (data: JoinGameData) =>
    {
      handleJoinGameRoom(io, socket, data);
    });

    socket.on('gameroom:leave', (data: LeaveGameData) =>
    {
      handleLeaveGameRoom(io, socket, data);
    });

    // Disconnect handling
    socket.on('disconnect', (reason: string) =>
    {
      handleDisconnect(io, socket, reason);
    });

    // Heartbeat/ping for connection monitoring with device session update
    socket.on(
      'ping',
      async (data?: { deviceId?: string; gameCode?: string; }) =>
      {
        if (data?.deviceId)
        {
          try
          {
            await updateLastSeen(data.deviceId, data.gameCode);
          }
          catch (error)
          {
            console.error('Error updating last seen:', error);
          }
        }
        socket.emit('pong');
      },
    );
  });

  if (!cleanup) return;
  // Start periodic cleanup of stale sessions (every 30 minutes)
  setInterval(
    async () =>
    {
      try
      {
        await cleanupStaleSessions();
      }
      catch (error)
      {
        console.error('Error during session cleanup:', error);
      }
    },
    30 * 60 * 1000,
  );
}

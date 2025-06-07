import { Server as SocketIOServer, Socket } from 'socket.io';
import { findById, select, update } from '../db/utils';
import { Game, Team, Player } from '../db/schema';
import { withTransaction } from '../db/connection';
import {
  createOrUpdateDeviceSession,
  getDeviceSession,
  getDeviceSessionBySocket,
  deactivateDeviceSessionBySocket,
  updateLastSeen,
  cleanupStaleSessions,
  generateDeviceId,
} from './deviceSessionManager';

// ==================== Socket Event Interfaces ====================

export interface JoinGameData {
  gameCode: string;
  playerId: string;
  playerName: string;
  deviceId: string;
}

export interface LeaveGameData {
  gameCode: string;
  playerId: string;
}

export interface PlayerUpdateData {
  gameCode: string;
  playerId: string;
  updates: {
    isConnected?: boolean;
    teamId?: string;
  };
}

export interface GameStateUpdate {
  gameCode: string;
  status?: string;
  currentRound?: number;
  currentTeam?: number;
  currentPlayer?: string;
  timerState?: {
    isRunning: boolean;
    timeRemaining: number;
    startedAt?: string;
  };
}

export interface PhraseSubmissionUpdate {
  gameCode: string;
  playerId: string;
  submittedCount: number;
  totalRequired: number;
}

export interface TeamAssignmentData {
  gameCode: string;
  playerId: string;
  teamId: string;
}

// ==================== Socket Connection Management ====================

interface ConnectedPlayer {
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
 * - Initiated by client via 'join-gameroom' event
 * - Requires gameCode, playerId, and playerName
 * - Validates that the player exists in the game
 * - Handles reconnection by disconnecting any existing socket for the same player
 * - Updates player's connection status to true in database
 * - Joins the Socket.IO room for the game
 * - Sends current game state to the newly connected player
 *
 * Emits:
 * - 'gameroom-joined' - To the connecting player confirming join
 * - 'player-connected' - To all players in game notifying of new connection
 * - 'current-game-state' - To the connecting player with full game state
 * - 'error' - If validation fails or any error occurs
 */
export async function handleJoinGameRoom(
  io: SocketIOServer,
  socket: Socket,
  data: JoinGameData
): Promise<void> {
  try {
    const { gameCode, playerId, playerName, deviceId } = data;

    // Validate input
    if (!gameCode || !playerId || !playerName || !deviceId) {
      socket.emit('error', {
        message:
          'Missing required fields: gameCode, playerId, playerName, deviceId',
      });
      return;
    }

    await withTransaction(async transaction => {
      // Verify game exists
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Verify player exists in game
      const player = await findById<Player>('players', playerId, transaction);
      if (!player || player.game_id !== gameCode) {
        // Player should have already joined the game via REST API
        socket.emit('error', {
          message:
            'Player not found in this game. Make sure to join via REST API first.',
        });
        return;
      }

      // Create or update device session
      await createOrUpdateDeviceSession(
        transaction,
        deviceId,
        socket.id,
        playerId,
        gameCode
      );

      // Check if player is already connected on another socket
      // if they are, disconnect the old socket
      const existingSocketId = playerSockets.get(playerId);
      if (existingSocketId && existingSocketId !== socket.id) {
        // Disconnect the old socket
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          // Check if this is a reconnection from the same device
          const existingSession =
            await getDeviceSessionBySocket(existingSocketId);
          const isReconnection =
            existingSession && existingSession.device_id === deviceId;

          existingSocket.emit('connection-replaced', {
            message: isReconnection
              ? 'You have reconnected from the same device'
              : 'You have connected from another device',
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
        transaction
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
      socket.emit('gameroom-joined', {
        gameCode,
        playerId,
        playerName,
        connectedAt: playerConnection.connectedAt,
      });

      // Notify other players in the game that this player has connected
      io.to(gameCode).emit('player-connected', {
        playerId,
        playerName,
        connectedAt: playerConnection.connectedAt,
      });

      // Send current game state to the newly connected player
      await sendGameStateToPlayer(socket, gameCode, transaction);

      console.log(
        `Player ${playerName} (${playerId}) joined game ${gameCode} on socket ${socket.id}`
      );
    });
  } catch (error) {
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
 * - Initiated by client via 'leave-gameroom' event
 * - Requires gameCode and playerId
 * - Updates player's connection status to false in database
 * - Removes player from Socket.IO room
 * - Cleans up connection tracking data
 * - Validates that the player is leaving the correct game
 *
 * Emits:
 * - 'player-disconnected' - To all remaining players in game
 * - 'error' - If validation fails or game code mismatch
 */
export async function handleLeaveGameRoom(
  io: SocketIOServer,
  socket: Socket,
  data: LeaveGameData
): Promise<void> {
  try {
    const { gameCode, playerId } = data;

    await withTransaction(async transaction => {
      // Update player connection status in database
      if (playerId) {
        await update(
          'players',
          { is_connected: false },
          [{ field: 'id', operator: '=', value: playerId }],
          transaction
        );
      }

      const playerConnection = connectedPlayers.get(socket.id);

      // Validate player connection exists
      if (!playerConnection) {
        return;
      }

      // Validate game code matches the game the player is connected to
      if (playerConnection.gameCode !== gameCode) {
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
      io.to(gameCode).emit('player-disconnected', {
        playerId: playerConnection.playerId,
        playerName: playerConnection.playerName,
        disconnectedAt: new Date(),
      });

      console.log(
        `Player ${playerConnection.playerName} left game ${gameCode}`
      );
    });
  } catch (error) {
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
 * - 'player-disconnected' - To all remaining players in game notifying of disconnection
 *
 * Note: Cannot emit to the disconnecting player as they are no longer connected
 */
export async function handleDisconnect(
  io: SocketIOServer,
  socket: Socket,
  reason: string
): Promise<void> {
  try {
    const playerConnection = connectedPlayers.get(socket.id);

    if (playerConnection) {
      await withTransaction(async transaction => {
        // Deactivate device session
        await deactivateDeviceSessionBySocket(transaction, socket.id);

        // Update player connection status in database
        await update(
          'players',
          { is_connected: false },
          [{ field: 'id', operator: '=', value: playerConnection.playerId }],
          transaction
        );

        // Clean up tracking
        connectedPlayers.delete(socket.id);
        playerSockets.delete(playerConnection.playerId);

        // Notify other players in the game
        io.to(playerConnection.gameCode).emit('player-disconnected', {
          playerId: playerConnection.playerId,
          playerName: playerConnection.playerName,
          disconnectedAt: new Date(),
          reason,
        });

        console.log(
          `Player ${playerConnection.playerName} disconnected from game ${playerConnection.gameCode} (${reason})`
        );
      });
    }
  } catch (error) {
    console.error('Error in handleDisconnect:', error);
  }
}

/**
 * Handle team assignment updates
 *
 * This is triggered to broadcast team assignment changes to all players
 * in a game. Note: This handler only validates and broadcasts - the actual
 * team assignment is done via the REST API.
 *
 * Key characteristics:
 * - Initiated by client via 'assigned-team' event
 * - Only broadcasts if player is already assigned to the team
 * - Does NOT perform the actual team assignment (REST API responsibility)
 * - Validates game is in correct state (waiting or phrase_submission)
 * - Ensures team assignment integrity
 *
 * Purpose:
 * - Synchronize team assignments across all connected clients
 * - Ensure real-time updates when teams change
 * - Maintain separation of concerns (REST handles data, Socket.IO handles notifications)
 *
 * Emits:
 * - 'team-assignment-updated' - To all players in game with assignment details
 * - 'error' - If validation fails or player not assigned to team
 */
export async function handleAssignedTeam(
  io: SocketIOServer,
  socket: Socket,
  data: TeamAssignmentData
): Promise<void> {
  try {
    const { gameCode, playerId, teamId } = data;

    await withTransaction(async transaction => {
      // Verify game exists
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        socket.emit('error', { message: 'Invalid game' });
        return;
      }

      // Only allow team assignment before game starts
      if (game.status !== 'waiting' && game.status !== 'phrase_submission') {
        socket.emit('error', {
          message: 'Cannot change teams after game has started',
        });
        return;
      }

      // Verify player exists in the game
      const player = await findById<Player>('players', playerId, transaction);
      if (!player || player.game_id !== gameCode) {
        socket.emit('error', { message: 'Invalid player id' });
        return;
      }

      // Verify team exists in the game
      const team = await findById<Team>('teams', teamId, transaction);
      if (!team || team.game_id !== gameCode) {
        socket.emit('error', { message: 'Invalid team id' });
        return;
      }

      // Check if the player is assigned to the team
      if (
        player.team_id !== teamId &&
        player.team_id !== team.id &&
        team.id !== teamId
      ) {
        // If player is not assigned to the team then
        // return error as only the REST API should handle team assignments
        socket.emit('error', {
          message:
            'Player is not assigned to team. Use REST API to assign teams.',
        });
        return;
      }

      // Broadcast team assignment to all players in the game
      io.to(gameCode).emit('team-assignment-updated', {
        playerId,
        teamId,
        playerName: player.name,
        updatedAt: new Date(),
      });

      console.log(
        `Player ${player.name} assigned to team ${teamId} in game ${gameCode}`
      );
    });
  } catch (error) {
    console.error('Error in handleTeamAssignmentBroadcast:', error);
    socket.emit('error', {
      message: 'Failed to broadcast team assignment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ==================== Broadcast Functions ====================

/**
 * Broadcast game state update to all players in a game
 */
export async function broadcastGameStateUpdate(
  io: SocketIOServer,
  update: GameStateUpdate
): Promise<void> {
  try {
    const { gameCode, ...stateData } = update;

    io.to(gameCode).emit('game-state-updated', {
      gameCode,
      ...stateData,
      updatedAt: new Date(),
    });

    console.log(
      `Broadcasting game state update for game ${gameCode}:`,
      stateData
    );
  } catch (error) {
    console.error('Error broadcasting game state update:', error);
  }
}

/**
 * Broadcast phrase submission update to all players in a game
 */
export async function broadcastPhraseSubmissionUpdate(
  io: SocketIOServer,
  update: PhraseSubmissionUpdate
): Promise<void> {
  try {
    const { gameCode, ...updateData } = update;

    io.to(gameCode).emit('phrase-submission-updated', {
      gameCode,
      ...updateData,
      updatedAt: new Date(),
    });

    console.log(
      `Broadcasting phrase submission update for game ${gameCode}:`,
      updateData
    );
  } catch (error) {
    console.error('Error broadcasting phrase submission update:', error);
  }
}

/**
 * Broadcast player update to all players in a game
 */
export async function broadcastPlayerUpdate(
  io: SocketIOServer,
  gameCode: string,
  playerUpdate: any
): Promise<void> {
  try {
    io.to(gameCode).emit('player-updated', {
      gameCode,
      ...playerUpdate,
      updatedAt: new Date(),
    });

    console.log(
      `Broadcasting player update for game ${gameCode}:`,
      playerUpdate
    );
  } catch (error) {
    console.error('Error broadcasting player update:', error);
  }
}

// ==================== Utility Functions ====================

/**
 * Send current game state to a specific player
 */
async function sendGameStateToPlayer(
  socket: Socket,
  gameCode: string,
  transaction: any
): Promise<void> {
  try {
    // Get current game state
    const game = await findById<Game>('games', gameCode, transaction);
    if (!game) return;

    // Get all players in the game
    const players = await select<Player>(
      'players',
      {
        where: [{ field: 'game_id', operator: '=', value: gameCode }],
      },
      transaction
    );

    // Send comprehensive game state
    socket.emit('current-game-state', {
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
  } catch (error) {
    console.error('Error sending game state to player:', error);
  }
}

/**
 * Get connected players count for a game
 */
export function getConnectedPlayersCount(gameCode: string): number {
  let count = 0;
  for (const playerConnection of connectedPlayers.values()) {
    if (playerConnection.gameCode === gameCode) {
      count++;
    }
  }
  return count;
}

/**
 * Get all connected players for a game
 */
export function getConnectedPlayers(gameCode: string): ConnectedPlayer[] {
  const players: ConnectedPlayer[] = [];
  for (const playerConnection of connectedPlayers.values()) {
    if (playerConnection.gameCode === gameCode) {
      players.push(playerConnection);
    }
  }
  return players;
}

/**
 * Check if a player is connected
 */
export function isPlayerConnected(playerId: string): boolean {
  return playerSockets.has(playerId);
}

/**
 * Get socket for a specific player
 */
export function getPlayerSocket(
  io: SocketIOServer,
  playerId: string
): Socket | null {
  const socketId = playerSockets.get(playerId);
  if (socketId) {
    return io.sockets.sockets.get(socketId) || null;
  }
  return null;
}

/**
 * Register all Socket.IO event handlers
 */
export function registerSocketHandlers(io: SocketIOServer, cleanup: boolean = true): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Game room management
    socket.on('join-gameroom', (data: JoinGameData) => {
      handleJoinGameRoom(io, socket, data);
    });

    socket.on('leave-gameroom', (data: LeaveGameData) => {
      handleLeaveGameRoom(io, socket, data);
    });

    // Team management
    socket.on('assigned-team', (data: TeamAssignmentData) => {
      handleAssignedTeam(io, socket, data);
    });

    // Disconnect handling
    socket.on('disconnect', (reason: string) => {
      handleDisconnect(io, socket, reason);
    });

    // Device session reconnection
    socket.on(
      'reconnect-session',
      async (data: { deviceId: string; gameCode?: string }) => {
        try {
          const { deviceId, gameCode } = data;
          const existingSession = await getDeviceSession(deviceId, gameCode);

          if (existingSession && existingSession.player_id) {
            // Found existing session, attempt to rejoin
            const rejoinData: JoinGameData = {
              gameCode: existingSession.game_id || gameCode || '',
              playerId: existingSession.player_id,
              playerName: '', // We'll fetch this from the database
              deviceId: deviceId,
            };

            // Get player name from database
            const player = await findById<Player>(
              'players',
              existingSession.player_id
            );
            if (player) {
              rejoinData.playerName = player.name;
              rejoinData.gameCode = player.game_id;

              // Emit reconnection success and auto-rejoin
              socket.emit('session-reconnected', {
                success: true,
                session: existingSession,
                player: {
                  id: player.id,
                  name: player.name,
                  gameId: player.game_id,
                  teamId: player.team_id,
                },
              });

              // Auto-rejoin the game room
              await handleJoinGameRoom(io, socket, rejoinData);
            }
          } else {
            // No existing session found
            socket.emit('session-reconnected', {
              success: false,
              message: 'No previous session found for this device',
            });
          }
        } catch (error) {
          console.error('Error in reconnect-session:', error);
          socket.emit('session-reconnected', {
            success: false,
            message: 'Failed to reconnect session',
          });
        }
      }
    );

    // Generate new device ID
    socket.on('generate-device-id', () => {
      const newDeviceId = generateDeviceId();
      socket.emit('device-id-generated', { deviceId: newDeviceId });
    });

    // Heartbeat/ping for connection monitoring with device session update
    socket.on(
      'ping',
      async (data?: { deviceId?: string; gameCode?: string }) => {
        if (data?.deviceId) {
          try {
            await updateLastSeen(data.deviceId, data.gameCode);
          } catch (error) {
            console.error('Error updating last seen:', error);
          }
        }
        socket.emit('pong');
      }
    );
  });

  if(!cleanup) return;
  // Start periodic cleanup of stale sessions (every 30 minutes)
  setInterval(
    async () => {
      try {
        await cleanupStaleSessions();
      } catch (error) {
        console.error('Error during session cleanup:', error);
      }
    },
    30 * 60 * 1000
  );
}

import { Server as SocketIOServer, Socket } from 'socket.io';
import { findById, select, update, exists } from '../db/utils';
import { Game, Player } from '../db/schema';
import { withTransaction } from '../db/connection';

// ==================== Socket Event Interfaces ====================

export interface JoinGameData {
    gameCode: string;
    playerId: string;
    playerName: string;
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
 */
export async function handleJoinGame(
    io: SocketIOServer,
    socket: Socket,
    data: JoinGameData
): Promise<void> {
    try {
        const { gameCode, playerId, playerName } = data;

        // Validate input
        if (!gameCode || !playerId || !playerName) {
            socket.emit('error', {
                message: 'Missing required fields: gameCode, playerId, playerName'
            });
            return;
        }

        await withTransaction(async (transaction) => {
            // Verify game exists
            const game = await findById<Game>('games', gameCode, transaction);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            // Verify player exists in game
            const player = await findById<Player>('players', playerId, transaction);
            if (!player || player.game_id !== gameCode) {
                socket.emit('error', { message: 'Player not found in this game' });
                return;
            }

            // Check if player is already connected on another socket
            // if they are, disconnect the old socket
            const existingSocketId = playerSockets.get(playerId);
            if (existingSocketId && existingSocketId !== socket.id) {
                // Disconnect the old socket
                const existingSocket = io.sockets.sockets.get(existingSocketId);
                if (existingSocket) {
                    existingSocket.emit('connection-replaced', {
                        message: 'You have connected from another device'
                    });
                    existingSocket.disconnect();
                }
                // Clean up old connection data
                connectedPlayers.delete(existingSocketId);
            }

            // Update player connection status in database
            await update('players',
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
                connectedAt: new Date()
            };
            connectedPlayers.set(socket.id, playerConnection);
            playerSockets.set(playerId, socket.id);

            // Join game room
            socket.join(gameCode);

            // Notify the player that they have joined the game
            socket.emit('game-joined', {
                gameCode,
                playerId,
                playerName,
                connectedAt: playerConnection.connectedAt
            });

            // Notify other players in the game that this player has connected
            io.to(gameCode).emit('player-connected', {
                playerId,
                playerName,
                connectedAt: playerConnection.connectedAt
            });

            // Send current game state to the newly connected player
            await sendGameStateToPlayer(socket, gameCode, transaction);

            console.log(`Player ${playerName} (${playerId}) joined game ${gameCode} on socket ${socket.id}`);
        });

    } catch (error) {
        console.error('Error in handleJoinGame:', error);
        socket.emit('error', {
            message: 'Failed to join game',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Handle player leaving a game room
 */
export async function handleLeaveGame(
    io: SocketIOServer,
    socket: Socket,
    data: LeaveGameData
): Promise<void> {
    try {
        const { gameCode, playerId } = data;

        await withTransaction(async (transaction) => {
            // Update player connection status in database
            if (playerId) {
                await update('players',
                    { is_connected: false },
                    [{ field: 'id', operator: '=', value: playerId }],
                    transaction
                );
            }

            // Clean up connection tracking
            const playerConnection = connectedPlayers.get(socket.id);
            if (playerConnection) {
                connectedPlayers.delete(socket.id);
                playerSockets.delete(playerConnection.playerId);

                // Leave game room
                socket.leave(gameCode);

                // Notify other players
                io.to(gameCode).emit('player-disconnected', {
                    playerId: playerConnection.playerId,
                    playerName: playerConnection.playerName,
                    disconnectedAt: new Date()
                });

                console.log(`Player ${playerConnection.playerName} left game ${gameCode}`);
            }
        });

    } catch (error) {
        console.error('Error in handleLeaveGame:', error);
        socket.emit('error', {
            message: 'Failed to leave game',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Handle socket disconnection (cleanup)
 */
export async function handleDisconnect(
    io: SocketIOServer,
    socket: Socket,
    reason: string
): Promise<void> {
    try {
        const playerConnection = connectedPlayers.get(socket.id);

        if (playerConnection) {
            await withTransaction(async (transaction) => {
                // Update player connection status in database
                await update('players',
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
                    reason
                });

                console.log(`Player ${playerConnection.playerName} disconnected from game ${playerConnection.gameCode} (${reason})`);
            });
        }

    } catch (error) {
        console.error('Error in handleDisconnect:', error);
    }
}

/**
 * Handle team assignment updates
 */
export async function handleTeamAssignment(
    io: SocketIOServer,
    socket: Socket,
    data: TeamAssignmentData
): Promise<void> {
    try {
        const { gameCode, playerId, teamId } = data;

        await withTransaction(async (transaction) => {
            // Verify game exists
            const game = await findById<Game>('games', gameCode, transaction);
            if (!game) {
                socket.emit('error', { message: 'Invalid game' });
                return;
            }

            // Verify player exists in the game
            const player = await findById<Player>('players', playerId, transaction);
            if (!player) {
                socket.emit('error', { message: 'Invalid game or player' });
                return;
            }

            // Verify team exists in the game
            if (player.game_id !== gameCode) {
                socket.emit('error', { message: 'Player does not belong to this game' });
                return;
            }

            // Only allow team assignment before game starts
            if (game.status !== 'waiting' && game.status !== 'phrase_submission') {
                socket.emit('error', { message: 'Cannot change teams after game has started' });
                return;
            }

            // Update player's team assignment
            await update('players',
                { team_id: teamId },
                [{ field: 'id', operator: '=', value: playerId }],
                transaction
            );

            // Broadcast team assignment to all players in the game
            io.to(gameCode).emit('team-assignment-updated', {
                playerId,
                teamId,
                playerName: player.name,
                updatedAt: new Date()
            });

            console.log(`Player ${player.name} assigned to team ${teamId} in game ${gameCode}`);
        });

    } catch (error) {
        console.error('Error in handleTeamAssignment:', error);
        socket.emit('error', {
            message: 'Failed to update team assignment',
            details: error instanceof Error ? error.message : 'Unknown error'
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
            updatedAt: new Date()
        });

        console.log(`Broadcasting game state update for game ${gameCode}:`, stateData);

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
            updatedAt: new Date()
        });

        console.log(`Broadcasting phrase submission update for game ${gameCode}:`, updateData);

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
            updatedAt: new Date()
        });

        console.log(`Broadcasting player update for game ${gameCode}:`, playerUpdate);

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
        const players = await select<Player>('players', {
            where: [{ field: 'game_id', operator: '=', value: gameCode }]
        }, transaction);

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
                startedAt: game.started_at
            },
            players: players.map(player => ({
                id: player.id,
                name: player.name,
                teamId: player.team_id,
                isConnected: player.is_connected,
                joinedAt: player.created_at
            }))
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
export function getPlayerSocket(io: SocketIOServer, playerId: string): Socket | null {
    const socketId = playerSockets.get(playerId);
    if (socketId) {
        return io.sockets.sockets.get(socketId) || null;
    }
    return null;
}

/**
 * Register all Socket.IO event handlers
 */
export function registerSocketHandlers(io: SocketIOServer): void {
    io.on('connection', (socket: Socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Game room management
        socket.on('join-game', (data: JoinGameData) => {
            handleJoinGame(io, socket, data);
        });

        socket.on('leave-game', (data: LeaveGameData) => {
            handleLeaveGame(io, socket, data);
        });

        // Team management
        socket.on('assign-team', (data: TeamAssignmentData) => {
            console.log(`Socket Id: ${socket.id} Event: assign-team`);
            console.log(data);
            handleTeamAssignment(io, socket, data);
        });

        // Disconnect handling
        socket.on('disconnect', (reason: string) => {
            handleDisconnect(io, socket, reason);
        });

        // Heartbeat/ping for connection monitoring
        socket.on('ping', () => {
            socket.emit('pong');
        });
    });
}

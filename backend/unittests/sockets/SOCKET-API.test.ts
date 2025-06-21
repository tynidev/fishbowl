import { Server as SocketIOServer } from "socket.io";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { createRealDataStoreFromScenario } from "../test-helpers/realDbUtils";
import * as factories from "../test-helpers/test-factories";
import * as helpers from "../test-helpers/test-helpers";
import * as SocketAPI from "../../src/sockets/SOCKET-API";
import { TransactionConnection, withTransaction } from "../../src/db/connection";
import {
    insert,
    select,
    findById,
    exists,
    update,
} from '../../src/db/utils';
import { createServer } from "http";
import { registerSocketHandlers } from "../../src/sockets/SOCKET-API";
import { Game, Player } from "../../src/db/schema";

// Test Setup and Configuration
describe("SOCKET-API Tests", () => {
    let server: SocketIOServer;
    let httpServer: any;
    let clientSocket: ClientSocket;
    let serverSocket: any;

    beforeAll((done) => {
        httpServer = createServer();
        server = new SocketIOServer(httpServer);
        httpServer.listen(() => {
            const port = (httpServer.address() as any).port;
            clientSocket = Client(`http://localhost:${port}`);

            // Register the Socket.IO handlers
            registerSocketHandlers(server, false);

            server.on('connection', (socket) => {
                serverSocket = socket;
            });

            clientSocket.on('connect', done);
        });
    });

    afterAll((done) => {
        // Remove all listeners to prevent memory leaks
        if (clientSocket) {
            clientSocket.removeAllListeners();
        }
        if (server) {
            server.removeAllListeners();
        }

        // Close client socket first
        if (clientSocket?.connected) {
            clientSocket.close();
        }

        // Close Socket.IO server
        server.close(() => {
            // Close HTTP server after Socket.IO server is closed
            httpServer.close(() => {
                setTimeout(done, 500); // wait a bit to ensure all connections are closed
            });
        });
    });

    describe("handleJoinGameRoom Tests", () => {
        // 4. Test successful game room join
        test("should allow a player to successfully join a game room and receive correct events", async () => {
            // 4.1. Create game scenario with `createGameSetup` factory with specific sub-status
            const gameSetup = factories.createGameSetup({
                gameStatus: 'setup',
                gameSubStatus: 'waiting_for_players'
            });
            const { game, players } = gameSetup;

            // Setup database with `createRealDataStoreFromScenario`
            await createRealDataStoreFromScenario(gameSetup).initDb();

            // First Player that is going to join the game with a device
            const joinPayload = {
                gameCode: game.id,
                playerId: players[0]!.id,
                playerName: players[0]!.name,
                deviceId: "test-device-id",
            };

            // Connect the first players device to the game room
            clientSocket.emit('gameroom:join', joinPayload);

            // Wait for the join to complete by listening for required events
            await hasJoinedGame(clientSocket, game, players, joinPayload);

            // Verify player connection status is updated in database
            const updatedPlayer = await findById('players', joinPayload.playerId);
            expect(Boolean(updatedPlayer!.is_connected)).toBe(true);

            // Verify device session (assuming direct access or a method on dbInstance)
            const deviceSessions = await select('device_sessions', {
                where: [
                    { field: 'device_id', operator: '=', value: "test-device-id" },
                    { field: 'player_id', operator: '=', value: joinPayload.playerId }
                ]
            });
            expect(deviceSessions.length).toBe(1);

            const deviceSession = deviceSessions[0];
            expect(Boolean(deviceSession?.is_active)).toBe(true);
            expect(deviceSession?.device_id).toBe(joinPayload.deviceId);
        });
    });

    /**
     * Helper function to wait for game join completion by listening for required socket events
     */
    const hasJoinedGame = (socket: ClientSocket, game: Game, players: Player[], joinPayload: any): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            let gameroomJoinedCalled = false;
            let playerConnectedCalled = false;
            let currentGameStateCalled = false;

            const checkDone = () => {
                if (gameroomJoinedCalled && playerConnectedCalled && currentGameStateCalled) {
                    resolve();
                }
            };

            socket.once('gameroom:joined', (response) => {
                expect(response.gameCode).toBe(joinPayload.gameCode);
                expect(response.playerId).toBe(joinPayload.playerId);
                expect(response.playerName).toBe(joinPayload.playerName);
                gameroomJoinedCalled = true;
                checkDone();
            });

            // clientSocket should receive 'player-connected' as it's in the game room.
            socket.once('gameroom:player:joined', (data) => {
                // Payload for 'player-connected' is { playerId, playerName, connectedAt }
                expect(data.playerId).toBe(joinPayload.playerId);
                expect(data.playerName).toBe(joinPayload.playerName);
                expect(data.connectedAt).toBeDefined();
                playerConnectedCalled = true;
                checkDone();
            });
            // Optionally, also listen for 'game:state' if it's part of this test's success criteria
            socket.once('game:state', (data) => {
                expect(data.game).toBeDefined();
                expect(data.game.id).toBe(game.id);
                expect(data.game.status).toBe(game.status);

                // shallow players comparison using length first
                expect(data.players).toHaveLength(players.length);

                // Transform expected players to match socket API response format
                const expectedSocketPlayers = players.map(player => ({
                    id: player.id,
                    name: player.name,
                    teamId: player.team_id,
                    isConnected: Boolean(player.is_connected),
                    joinedAt: player.created_at,
                }));

                // Deep comparison between players and data.players using Player schema
                expect(data.players).toEqual(expect.arrayContaining(
                    expectedSocketPlayers.map(expectedPlayer =>
                        expect.objectContaining(expectedPlayer)
                    )
                ));
                currentGameStateCalled = true;
                checkDone();
            });
        });
    };

    // 5. Test validation failures
    // 5.1. Test missing required fields (gameCode, playerId, playerName, deviceId)
    test("should emit error for missing gameCode", async () => {
        const joinPayload = {
            playerId: "test-player-id",
            playerName: "Test Player",
            deviceId: "test-device-id",
        };

        clientSocket.emit('gameroom:join', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    test("should emit error for missing playerId", async () => {
        const joinPayload = {
            gameCode: "TEST123",
            playerName: "Test Player",
            deviceId: "test-device-id",
        };

        clientSocket.emit('gameroom:join', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    test("should emit error for missing playerName", async () => {
        const joinPayload = {
            gameCode: "TEST123",
            playerId: "test-player-id",
            deviceId: "test-device-id",
        };

        clientSocket.emit('gameroom:join', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    test("should emit error for missing deviceId", async () => {
        const joinPayload = {
            gameCode: "TEST123",
            playerId: "test-player-id",
            playerName: "Test Player",
        };

        clientSocket.emit('gameroom:join', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    // 5.2. Test with non-existent game
    test("should emit error for non-existent game", async () => {
        const joinPayload = {
            gameCode: "NONEXISTENT",
            playerId: "test-player-id",
            playerName: "Test Player",
            deviceId: "test-device-id",
        };

        clientSocket.emit('gameroom:join', joinPayload);

        await expectErrorEvent(clientSocket, "Game not found");
    });

    // 5.3. Test with player not in game
    test("should emit error when player is not in the specified game", async () => {
        // Create a game setup
        const gameSetup = factories.createGameSetup({});
        const { game } = gameSetup;
        await createRealDataStoreFromScenario(gameSetup).initDb();

        // Create a different player not in this game
        const otherPlayerPayload = {
            gameCode: game.id,
            playerId: "non-existent-player-id",
            playerName: "Other Player",
            deviceId: "test-device-id",
        };

        clientSocket.emit('gameroom:join', otherPlayerPayload);

        await expectErrorEvent(clientSocket, "Player not found in this game. Make sure to join via REST API first.");
    });

    // Test with different game sub-status to demonstrate new gameSubStatus parameter
    test("should allow player to join game with specific sub-status (ready_to_start)", async () => {
        // Create game setup with specific sub-status using new gameSubStatus parameter
        const gameSetup = factories.createGameSetup({
            gameStatus: 'setup',
            gameSubStatus: 'ready_to_start'
        });
        const { game, players } = gameSetup;

        // Setup database
        await createRealDataStoreFromScenario(gameSetup).initDb();

        const joinPayload = {
            gameCode: game.id,
            playerId: players[0]!.id,
            playerName: players[0]!.name,
            deviceId: "test-device-ready-to-start",
        };

        // Connect player to the game room
        clientSocket.emit('gameroom:join', joinPayload);

        // Wait for join completion
        await hasJoinedGame(clientSocket, game, players, joinPayload);

        // Verify the game has the correct sub-status
        expect(game.sub_status).toBe('ready_to_start');
    });

    // 5.4. Test with invalid player ID for game
    test("should emit error for invalid player ID format", async () => {
        const gameSetup = factories.createGameSetup({});
        const { game } = gameSetup;
        await createRealDataStoreFromScenario(gameSetup).initDb();

        const joinPayload = {
            gameCode: game.id,
            playerId: "", // Empty string as invalid format
            playerName: "Test Player",
            deviceId: "test-device-id",
        };

        clientSocket.emit('gameroom:join', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    describe("Game Event Broadcast Tests", () => {
        // Test round:started broadcast
        test("should broadcast round:started event to all players in game", async () => {
            jest.setTimeout(15000); // Increase timeout for this test
            const gameCode = "TEST123";
            const roundData: SocketAPI.RoundStartedData = {
                gameCode,
                round: 1,
                roundName: "Taboo",
                startedAt: new Date()
            };

            // Set up an event listener for the round:started event
            const eventPromise = new Promise<void>((resolve) => {
                clientSocket.once("round:started", (data) => {
                    // Check everything except dates which may be serialized
                    expect(data.gameCode).toEqual(roundData.gameCode);
                    expect(data.round).toEqual(roundData.round);
                    expect(data.roundName).toEqual(roundData.roundName);
                    expect(data.startedAt).toEqual(roundData.startedAt.toISOString());
                    resolve();
                });
            });

            // Join the game room first
            server.socketsJoin(gameCode);
            clientSocket.emit("gameroom:join", gameCode);

            // Broadcast the event
            await SocketAPI.broadcastRoundStarted(server, roundData);
            
            // Wait for the event to be received
            await eventPromise;
        });

        // Test round:ended broadcast
        test("should broadcast round:ended event with scores", async () => {
            jest.setTimeout(15000); // Increase timeout for this test
            const gameCode = "TEST123";
            const roundData: SocketAPI.RoundEndedData = {
                gameCode,
                round: 1,
                roundScores: [
                    { teamName: "Team A", score: 10 },
                    { teamName: "Team B", score: 8 }
                ],
                endedAt: new Date()
            };

            // Set up an event listener for the round:ended event
            const eventPromise = new Promise<void>((resolve) => {
                clientSocket.once("round:ended", (data) => {
                    // Check everything except dates which may be serialized
                    expect(data.gameCode).toEqual(roundData.gameCode);
                    expect(data.round).toEqual(roundData.round);
                    expect(data.roundScores).toHaveLength(2);
                    expect(data.roundScores[0].teamName).toBe(roundData.roundScores[0]!.teamName);
                    expect(data.roundScores[0].score).toBe(roundData.roundScores[0]!.score);
                    expect(data.roundScores[1].teamName).toBe(roundData.roundScores[1]!.teamName);
                    expect(data.roundScores[1].score).toBe(roundData.roundScores[1]!.score);
                    expect(data.endedAt).toBeDefined();
                    resolve();
                });
            });

            // Join the game room first
            server.socketsJoin(gameCode);
            clientSocket.emit("gameroom:join", gameCode);

            // Broadcast the event
            await SocketAPI.broadcastRoundEnded(server, roundData);
            
            // Wait for the event to be received
            await eventPromise;
        });

        // Test turn:started broadcast
        test("should broadcast turn:started event", async () => {
            const gameCode = "TEST123";
            const turnData: SocketAPI.TurnStartedData = {
                gameCode,
                round: 2,
                playerName: "John Doe",
                teamName: "Team A",
                startedAt: new Date()
            };

            // Set up an event listener for the turn:started event
            const eventPromise = new Promise<void>((resolve) => {
                clientSocket.once("turn:started", (data) => {
                    // Check everything except dates which may be serialized
                    expect(data.gameCode).toEqual(turnData.gameCode);
                    expect(data.round).toEqual(turnData.round);
                    expect(data.playerName).toBe(turnData.playerName);
                    expect(data.teamName).toBe(turnData.teamName);
                    expect(data.startedAt).toBeDefined();
                    resolve();
                });
            });

            // Join the game room first
            server.socketsJoin(gameCode);
            clientSocket.emit("gameroom:join", gameCode);

            // Broadcast the event
            await SocketAPI.broadcastTurnStarted(server, turnData);
            
            // Wait for the event to be received
            await eventPromise;
        });

        // Test turn:paused broadcast
        test("should broadcast turn:paused event with reason", async () => {
            const gameCode = "TEST123";
            const turnData: SocketAPI.TurnPausedData = {
                gameCode,
                round: 2,
                playerName: "John Doe",
                pausedAt: new Date(),
                pausedReason: "host_paused"
            };

            // Set up an event listener for the turn:paused event
            const eventPromise = new Promise<void>((resolve) => {
                clientSocket.once("turn:paused", (data) => {
                    // Check everything except dates which may be serialized
                    expect(data.gameCode).toEqual(turnData.gameCode);
                    expect(data.round).toEqual(turnData.round);
                    expect(data.playerName).toBe(turnData.playerName);
                    expect(data.pausedReason).toBe(turnData.pausedReason);
                    expect(data.pausedAt).toEqual(turnData.pausedAt.toISOString());
                    resolve();
                });
            });

            // Join the game room first
            server.socketsJoin(gameCode);
            clientSocket.emit("gameroom:join", gameCode);

            // Broadcast the event
            await SocketAPI.broadcastTurnPaused(server, turnData);
            
            // Wait for the event to be received
            await eventPromise;
        });

        // Test turn:ended broadcast
        test("should broadcast turn:ended event with statistics", async () => {
            const gameCode = "TEST123";
            const turnData: SocketAPI.TurnEndedData = {
                gameCode,
                round: 3,
                playerName: "John Doe",
                phrasesGuessed: 5,
                phrasesSkipped: 1,
                pointsScored: 5,
                endedAt: new Date()
            };

            // Set up an event listener for the turn:ended event
            const eventPromise = new Promise<void>((resolve) => {
                clientSocket.once("turn:ended", (data) => {
                    // Check everything except dates which may be serialized
                    expect(data.gameCode).toEqual(turnData.gameCode);
                    expect(data.round).toEqual(turnData.round);
                    expect(data.playerName).toBe(turnData.playerName);
                    expect(data.phrasesGuessed).toBe(turnData.phrasesGuessed);
                    expect(data.phrasesSkipped).toBe(turnData.phrasesSkipped);
                    expect(data.pointsScored).toBe(turnData.pointsScored);
                    expect(data.endedAt).toEqual(turnData.endedAt.toISOString());
                    resolve();
                });
            });

            // Join the game room first
            server.socketsJoin(gameCode);
            clientSocket.emit("gameroom:join", gameCode);

            // Broadcast the event
            await SocketAPI.broadcastTurnEnded(server, turnData);
            
            // Wait for the event to be received
            await eventPromise;
        });
    });
});

/**
 * Helper function to wait for error events from socket
 */
const expectErrorEvent = (socket: ClientSocket, expectedMessage: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Expected error event with message "${expectedMessage}" but none received within timeout`));
        }, 5000);

        socket.once('error', (error) => {
            clearTimeout(timeout);
            expect(error.message).toBe(expectedMessage);
            resolve();
        });
    });
};
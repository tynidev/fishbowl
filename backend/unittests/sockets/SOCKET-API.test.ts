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
            // 4.1. Create game scenario with `createGameSetup` factory
            const gameSetup = factories.createGameSetup({}); // Use default config
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
            clientSocket.emit('join-gameroom', joinPayload);

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

            socket.once('gameroom-joined', (response) => {
                expect(response.gameCode).toBe(joinPayload.gameCode);
                expect(response.playerId).toBe(joinPayload.playerId);
                expect(response.playerName).toBe(joinPayload.playerName);
                gameroomJoinedCalled = true;
                checkDone();
            });

            // clientSocket should receive 'player-connected' as it's in the game room.
            socket.once('player-connected', (data) => {
                // Payload for 'player-connected' is { playerId, playerName, connectedAt }
                expect(data.playerId).toBe(joinPayload.playerId);
                expect(data.playerName).toBe(joinPayload.playerName);
                expect(data.connectedAt).toBeDefined();
                playerConnectedCalled = true;
                checkDone();
            });
            // Optionally, also listen for 'current-game-state' if it's part of this test's success criteria
            socket.once('current-game-state', (data) => {
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

        clientSocket.emit('join-gameroom', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    test("should emit error for missing playerId", async () => {
        const joinPayload = {
            gameCode: "TEST123",
            playerName: "Test Player",
            deviceId: "test-device-id",
        };

        clientSocket.emit('join-gameroom', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    test("should emit error for missing playerName", async () => {
        const joinPayload = {
            gameCode: "TEST123",
            playerId: "test-player-id",
            deviceId: "test-device-id",
        };

        clientSocket.emit('join-gameroom', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
    });

    test("should emit error for missing deviceId", async () => {
        const joinPayload = {
            gameCode: "TEST123",
            playerId: "test-player-id",
            playerName: "Test Player",
        };

        clientSocket.emit('join-gameroom', joinPayload);

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

        clientSocket.emit('join-gameroom', joinPayload);

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

        clientSocket.emit('join-gameroom', otherPlayerPayload);

        await expectErrorEvent(clientSocket, "Player not found in this game. Make sure to join via REST API first.");
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

        clientSocket.emit('join-gameroom', joinPayload);

        await expectErrorEvent(clientSocket, "Missing required fields: gameCode, playerId, playerName, deviceId");
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
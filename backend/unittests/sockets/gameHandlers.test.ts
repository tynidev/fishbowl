import {
    setupMockTransaction,
    resetAllMocks,
    mockedDbUtils,
} from '../routes/test-utils';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import {
    registerSocketHandlers,
    broadcastGameStateUpdate,
    broadcastPhraseSubmissionUpdate,
    getConnectedPlayersCount,
    isPlayerConnected,
    JoinGameData,
    LeaveGameData,
    TeamAssignmentData,
    GameStateUpdate,
    PhraseSubmissionUpdate
} from '../../src/sockets/SOCKET-API';

describe('Socket.IO Game Handlers', () => {
    let server: SocketIOServer;
    let httpServer: any;
    let clientSocket: ClientSocket;
    let serverSocket: any;
    let mockTransaction: any;

    beforeAll((done) => {
        httpServer = createServer();
        server = new SocketIOServer(httpServer);
        httpServer.listen(() => {
            const port = (httpServer.address() as any).port;
            clientSocket = Client(`http://localhost:${port}`);

            // Register the Socket.IO handlers
            registerSocketHandlers(server);

            server.on('connection', (socket) => {
                serverSocket = socket;
            });

            clientSocket.on('connect', done);
        });
    });

    afterAll(() => {
        server.close();
        clientSocket.close();
        httpServer.close();
    });

    beforeEach(() => {
        mockTransaction = setupMockTransaction();
        resetAllMocks();
    });

    describe('Connection and Registration', () => {
        test('should handle socket connection successfully', (done) => {
            expect(clientSocket.connected).toBe(true);
            done();
        });

        test('should register all event handlers', () => {
            // This test verifies that registerSocketHandlers doesn't throw
            expect(() => registerSocketHandlers(server)).not.toThrow();
        });
    });

    describe('join-gameroom event', () => {
        const mockJoinData: JoinGameData = {
            gameCode: 'ABCD',
            playerId: 'player-123',
            playerName: 'Test Player'
        };

        test('should handle database errors gracefully', (done) => {
            mockedDbUtils.findById.mockRejectedValueOnce(new Error('Database connection failed'));

            clientSocket.emit('join-gameroom', mockJoinData);

            clientSocket.once('error', (response) => {
                expect(response.message).toBe('Failed to join game');
                done();
            });
        });

        test('should handle game not found', (done) => {
            mockedDbUtils.findById.mockResolvedValueOnce(null); // Game doesn't exist

            clientSocket.emit('join-gameroom', mockJoinData);

            clientSocket.once('error', (response) => {
                expect(response.message).toBe('Game not found');
                done();
            });
        });

        test('should handle player not found in game', (done) => {
            mockedDbUtils.findById
                .mockResolvedValueOnce({
                    id: 'game-1',
                    game_code: mockJoinData.gameCode,
                    status: 'waiting'
                } as any) // Game exists
                .mockResolvedValueOnce(null as any); // Player doesn't exist

            clientSocket.emit('join-gameroom', mockJoinData);

            clientSocket.once('error', (response) => {
                expect(response.message).toBe('Player not found in this game. Make sure to join via REST API first.');
                done();
            });
        });

        test('should handle successful game join', (done) => {
            // Mock successful database responses
            mockedDbUtils.findById
                .mockResolvedValueOnce({
                    id: 'game-1',
                    game_code: mockJoinData.gameCode,
                    status: 'waiting'
                } as any) // Game exists
                .mockResolvedValueOnce({
                    id: mockJoinData.playerId,
                    game_id: mockJoinData.gameCode,
                    name: mockJoinData.playerName
                } as any); // Player exists in game

            mockedDbUtils.update.mockResolvedValueOnce(1);

            clientSocket.emit('join-gameroom', mockJoinData);

            clientSocket.once('gameroom-joined', (response) => {
                expect(response.gameCode).toBe('ABCD');
                expect(response.playerId).toBe('player-123');
                expect(response.playerName).toBe('Test Player');
                done();
            });
        });
    });

    describe('leave-gameroom event', () => {
        const mockLeaveData: LeaveGameData = {
            gameCode: 'ABCD',
            playerId: 'player-123'
        };

        test('should handle successful game leave', (done) => {
            // Mock the join-gameroom dependencies first
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'game-1',
                game_code: 'ABCD',
                status: 'waiting'
            } as any); // Game exists for join

            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'player-123',
                game_id: 'ABCD',
                name: 'Test Player'
            } as any); // Player exists in game for join

            mockedDbUtils.update.mockResolvedValueOnce(1); // Join update
            mockedDbUtils.update.mockResolvedValueOnce(1); // Leave update

            // First join the game
            clientSocket.emit('join-gameroom', {
                gameCode: 'ABCD',
                playerId: 'player-123',
                playerName: 'Test Player'
            });

            clientSocket.once('gameroom-joined', () => {
                // Now leave the game
                clientSocket.emit('leave-gameroom', mockLeaveData);

                // Since leave-gameroom doesn't emit a response, just verify it doesn't crash
                setTimeout(() => {
                    expect(clientSocket.connected).toBe(true);
                    done();
                }, 100);
            });
        });

        test('should handle game not found', (done) => {
            clientSocket.emit('leave-gameroom', mockLeaveData);

            // Since leave-gameroom doesn't emit error responses, just verify it doesn't crash
            setTimeout(() => {
                expect(clientSocket.connected).toBe(true);
                done();
            }, 100);
        });
    });

    describe('assigned-team event', () => {
        const playerName = 'Test Player';
        const mockAssignData: TeamAssignmentData = {
            gameCode: 'ABCD',
            playerId: 'player-123',
            teamId: 'team-1'
        };

        test('should handle successful team assignment', (done) => {
            // First, join the game to add socket to the room
            mockedDbUtils.findById
                .mockResolvedValueOnce({
                    id: 'game-1',
                    game_code: mockAssignData.gameCode,
                    status: 'waiting'
                } as any) // Game exists for join
                .mockResolvedValueOnce({
                    id: mockAssignData.playerId,
                    game_id: mockAssignData.gameCode,
                    name: playerName,
                } as any); // Player exists for join

            mockedDbUtils.update.mockResolvedValueOnce(1); // Join update
            mockedDbUtils.select.mockResolvedValueOnce([]); // Players for game state

            // Join the game first
            clientSocket.emit('join-gameroom', {
                gameCode: mockAssignData.gameCode,
                playerId: mockAssignData.playerId,
                playerName: playerName
            });

            clientSocket.once('gameroom-joined', () => {
                // Now setup mocks for team assignment
                mockedDbUtils.findById
                    .mockResolvedValueOnce({
                        id: 'game-1',
                        game_code: mockAssignData.gameCode,
                        status: 'waiting'
                    } as any) // Game exists
                    .mockResolvedValueOnce({
                        id: mockAssignData.playerId,
                        game_id: mockAssignData.gameCode,
                        name: playerName,
                    } as any) // Player exists in game
                    .mockResolvedValueOnce({
                        id: mockAssignData.teamId,
                        game_id: mockAssignData.gameCode,
                    } as any); // Team exists

                mockedDbUtils.update.mockResolvedValueOnce(1); // Team assignment update

                clientSocket.emit('assigned-team', mockAssignData);

                clientSocket.once('team-assignment-updated', (response) => {
                    expect(response.playerId).toBe(mockAssignData.playerId);
                    expect(response.teamId).toBe(mockAssignData.teamId);
                    expect(response.playerName).toBe(playerName);
                    done();
                });
            });
        });
    });

    describe('ping event', () => {
        test('should respond to ping with pong', (done) => {
            clientSocket.emit('ping');

            clientSocket.once('pong', () => {
                // Just verify pong was received
                done();
            });
        });
    });

    describe('Broadcast Functions', () => {
        test('broadcastGameStateUpdate should not throw', () => {
            const gameStateUpdate: GameStateUpdate = {
                gameCode: 'ABCD',
                status: 'playing',
                currentRound: 1
            };

            expect(() => {
                broadcastGameStateUpdate(server, gameStateUpdate);
            }).not.toThrow();
        });

        test('broadcastPhraseSubmissionUpdate should not throw', () => {
            const phraseUpdate: PhraseSubmissionUpdate = {
                gameCode: 'ABCD',
                playerId: 'player-123',
                submittedCount: 3,
                totalRequired: 5
            };

            expect(() => {
                broadcastPhraseSubmissionUpdate(server, phraseUpdate);
            }).not.toThrow();
        });
    });

    describe('Utility Functions', () => {
        test('getConnectedPlayersCount should return number', () => {
            const count = getConnectedPlayersCount('ABCD');
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
        });

        test('isPlayerConnected should return boolean', () => {
            const connected = isPlayerConnected('player-123');
            expect(typeof connected).toBe('boolean');
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed event data', (done) => {
            // Send invalid data
            clientSocket.emit('join-gameroom', { invalid: 'data' });

            // Should not crash the server
            setTimeout(() => {
                expect(clientSocket.connected).toBe(true);
                done();
            }, 100);
        });

        test('should handle events with missing required fields', (done) => {
            clientSocket.emit('join-gameroom', { gameCode: 'ABCD' }); // Missing playerId and playerName

            clientSocket.once('error', (response) => {
                expect(response.message).toContain('Missing required fields');
                done();
            });
        });
    });
});

// Integration test for Socket.IO server setup
describe('Socket.IO Server Integration', () => {
    test('should register handlers without throwing', () => {
        const mockServer = {
            on: jest.fn()
        } as any;

        expect(() => registerSocketHandlers(mockServer)).not.toThrow();
        expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
});
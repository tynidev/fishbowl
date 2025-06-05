import {
    setupMockTransaction,
    resetAllMocks,
    mockedDbUtils,
} from '../test-helpers';
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
            playerName: 'Test Player',
            deviceId: 'test-device-123'
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
            // 1. findById for Game in handleJoinGameRoom
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'game-1',
                game_code: mockJoinData.gameCode,
                status: 'waiting'
            } as any);
            // 2. findById for Player in handleJoinGameRoom
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: mockJoinData.playerId,
                game_id: mockJoinData.gameCode,
                name: mockJoinData.playerName
            } as any);

            // For createOrUpdateDeviceSession (called by handleJoinGameRoom)
            // 1. select for existing device_sessions - assuming no existing session
            mockedDbUtils.select.mockResolvedValueOnce([]); 
            
            // For update player is_connected (called by handleJoinGameRoom)
            mockedDbUtils.update.mockResolvedValueOnce(1);

            // Mocks for sendGameStateToPlayer (called by handleJoinGameRoom)
            // 3. findById for Game in sendGameStateToPlayer
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'game-1', name: 'Test Game', status: 'waiting', host_player_id: 'p1', 
                team_count: 2, phrases_per_player: 5, timer_duration: 60, 
                current_round: 0, current_team: 0, created_at: new Date().toISOString(), started_at: null
            } as any); 
            // 2. select for players in game for sendGameStateToPlayer
            mockedDbUtils.select.mockResolvedValueOnce([]); 

            let gameroomJoinedCalled = false;
            let playerConnectedCalled = false;
            let currentGameStateCalled = false; 

            const checkDone = () => {
                if (gameroomJoinedCalled && playerConnectedCalled && currentGameStateCalled) {
                    done();
                }
            };

            clientSocket.once('gameroom-joined', (response) => {
                expect(response.gameCode).toBe(mockJoinData.gameCode);
                expect(response.playerId).toBe(mockJoinData.playerId);
                expect(response.playerName).toBe(mockJoinData.playerName);
                gameroomJoinedCalled = true;
                checkDone();
            });

            // clientSocket should receive 'player-connected' as it's in the game room.
            clientSocket.once('player-connected', (data) => {
                // Payload for 'player-connected' is { playerId, playerName, connectedAt }
                expect(data.playerId).toBe(mockJoinData.playerId);
                expect(data.playerName).toBe(mockJoinData.playerName);
                expect(data.connectedAt).toBeDefined(); // Check that connectedAt is present
                playerConnectedCalled = true;
                checkDone();
            });

            // Optionally, also listen for 'current-game-state' if it's part of this test's success criteria
            clientSocket.once('current-game-state', (data) => {
                expect(data.game).toBeDefined();
                expect(data.game.id).toBe('game-1'); // From the mock for findById in sendGameStateToPlayer
                expect(data.game.status).toBe('waiting'); // From the mock
                expect(data.players).toEqual([]); // From the mock for select in sendGameStateToPlayer
                currentGameStateCalled = true;
                checkDone();
            });

            clientSocket.emit('join-gameroom', mockJoinData);
        });
    });

    describe('leave-gameroom event', () => {
        const mockLeaveData: LeaveGameData = {
            gameCode: 'ABCD',
            playerId: 'player-123'
        };

        test('should handle successful game leave', (done) => {
            const joinDataForLeaveTest: JoinGameData = {
                gameCode: mockLeaveData.gameCode,      // 'ABCD'
                playerId: mockLeaveData.playerId,      // 'player-123'
                playerName: 'Test Player To Leave', // Specific name for this test context
                deviceId: 'device-for-leave-test'   // Added deviceId
            };

            // Mocks for the 'join-gameroom' phase executed first:
            // 1. findById (Game in handleJoinGameRoom)
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'game-1', game_code: joinDataForLeaveTest.gameCode, status: 'waiting'
            } as any);
            // 2. findById (Player in handleJoinGameRoom)
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: joinDataForLeaveTest.playerId, game_id: joinDataForLeaveTest.gameCode, name: joinDataForLeaveTest.playerName
            } as any);
            // 3. select (device_sessions in createOrUpdateDeviceSession) - assuming no existing session
            mockedDbUtils.select.mockResolvedValueOnce([]);
            // 4. insert (device_sessions in createOrUpdateDeviceSession) - new session created
            mockedDbUtils.insert.mockResolvedValueOnce({ id: 'session-xyz', device_id: joinDataForLeaveTest.deviceId, player_id: joinDataForLeaveTest.playerId, game_id: joinDataForLeaveTest.gameCode } as any);
            // 5. update (Player is_connected = true in handleJoinGameRoom)
            mockedDbUtils.update.mockResolvedValueOnce(1);
            // 6. findById (Game in sendGameStateToPlayer)
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'game-1', name: 'Test Game For Leave', status: 'waiting', 
                host_player_id: 'p1', team_count: 2, phrases_per_player: 5, 
                timer_duration: 60, current_round: 0, current_team: 0, 
                created_at: new Date().toISOString(), started_at: null
            } as any); 
            // 7. select (Players in game for sendGameStateToPlayer)
            mockedDbUtils.select.mockResolvedValueOnce([]);

            // Mock for the 'leave-gameroom' phase:
            // 8. update (Player is_connected = false in handleLeaveGameRoom)
            mockedDbUtils.update.mockResolvedValueOnce(1); 

            // First, join the game
            clientSocket.emit('join-gameroom', joinDataForLeaveTest);

            clientSocket.once('gameroom-joined', (joinResponse) => {
                expect(joinResponse.gameCode).toBe(joinDataForLeaveTest.gameCode);
                expect(joinResponse.playerId).toBe(joinDataForLeaveTest.playerId);
                expect(joinResponse.playerName).toBe(joinDataForLeaveTest.playerName);

                // Now leave the game
                clientSocket.emit('leave-gameroom', mockLeaveData);

                // The 'player-disconnected' event is broadcast to other clients in the room.
                // The leaving client itself typically won't receive this after socket.leave().
                // This timeout primarily ensures the client socket remains connected to the server
                // and the server doesn't crash due to the leave operation with the provided mocks.
                // Verification of the database update (is_connected: false) relies on the mock being set up correctly
                // and consumed in the expected order.
                setTimeout(() => {
                    expect(clientSocket.connected).toBe(true);
                    done();
                }, 200); // Timeout to allow server processing
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
            teamId: 'team-1',
        };

        test('should handle successful team assignment', (done) => {
            // Mock successful database responses
            // 1. findById for Game in handleJoinGameRoom
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'game-1',
                game_code: mockAssignData.gameCode,
                status: 'waiting'
            } as any);
            // 2. findById for Player in handleJoinGameRoom
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: mockAssignData.playerId,
                game_id: mockAssignData.gameCode,
                name: playerName
            } as any);

            // For createOrUpdateDeviceSession (called by handleJoinGameRoom)
            // 1. select for existing device_sessions - assuming no existing session
            mockedDbUtils.select.mockResolvedValueOnce([]); 
            
            // For update player is_connected (called by handleJoinGameRoom)
            mockedDbUtils.update.mockResolvedValueOnce(1);

            // Mocks for sendGameStateToPlayer (called by handleJoinGameRoom)
            // 3. findById for Game in sendGameStateToPlayer
            mockedDbUtils.findById.mockResolvedValueOnce({
                id: 'game-1', name: 'Test Game', status: 'waiting', host_player_id: 'p1', 
                team_count: 2, phrases_per_player: 5, timer_duration: 60, 
                current_round: 0, current_team: 0, created_at: new Date().toISOString(), started_at: null
            } as any); 
            // 2. select for players in game for sendGameStateToPlayer
            mockedDbUtils.select.mockResolvedValueOnce([]); 

            // Join the game first
            clientSocket.emit('join-gameroom', {
                gameCode: mockAssignData.gameCode,
                playerId: mockAssignData.playerId,
                playerName: playerName,
                deviceId: 'test-device-123'
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
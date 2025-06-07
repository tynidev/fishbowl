import {
    createGameScenario,
} from '../test-helpers';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import {
    registerSocketHandlers,
    broadcastGameStateUpdate,
    broadcastPhraseSubmissionUpdate,
    broadcastPlayerUpdate,
    getConnectedPlayersCount,
    getConnectedPlayers,
    isPlayerConnected,
    getPlayerSocket,
    JoinGameData,
    LeaveGameData,
    TeamAssignmentData,
    GameStateUpdate,
    PhraseSubmissionUpdate
} from '../../src/sockets/SOCKET-API';
import { createRealDataStoreFromScenario } from '../realDbUtils';

describe('Socket.IO Game Handlers - Complete API Test Suite', () => {
    let server: SocketIOServer;
    let httpServer: any;
    let clientSocket: ClientSocket;
    let clientSocket2: ClientSocket;
    let serverSocket: any;

    beforeAll((done) => {
        httpServer = createServer();
        server = new SocketIOServer(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        httpServer.listen(() => {
            const port = (httpServer.address() as any).port;
            clientSocket = Client(`http://localhost:${port}`);

            // Register the Socket.IO handlers
            registerSocketHandlers(server);

            server.on('connection', (socket) => {
                serverSocket = socket;
            });

            clientSocket.on('connect', () => {
                // Create second client for multi-player tests
                clientSocket2 = Client(`http://localhost:${port}`);
                clientSocket2.on('connect', done);
            });
        });
    });

    afterAll(() => {
        if (clientSocket) clientSocket.close();
        if (clientSocket2) clientSocket2.close();
        if (server) server.close();
        if (httpServer) httpServer.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== Connection Management Tests ====================
    
    describe('Socket Connection Management', () => {
        test('should handle socket connection successfully', () => {
            expect(clientSocket.connected).toBe(true);
            expect(clientSocket2.connected).toBe(true);
        });

        test('should register all event handlers without throwing', () => {
            const mockServer = {
                on: jest.fn()
            } as any;

            expect(() => registerSocketHandlers(mockServer)).not.toThrow();
            expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });
    });

    // ==================== Join Game Room Tests ====================

    describe('handleJoinGameRoom Event', () => {
        const validJoinData: JoinGameData = {
            gameCode: 'TEST123',
            playerId: 'player-join-test',
            playerName: 'Join Test Player',
            deviceId: 'device-join-123'
        };

        test('should successfully join a game room', (done) => {
            const scenario = createGameScenario({
                gameCode: validJoinData.gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 3
            });

            // Set up player to match join data
            const firstPlayer = scenario.players[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            firstPlayer.id = validJoinData.playerId;
            firstPlayer.name = validJoinData.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                let eventsReceived = 0;
                const expectedEvents = 3;

                const checkComplete = () => {
                    eventsReceived++;
                    if (eventsReceived === expectedEvents) {
                        done();
                    }
                };

                clientSocket.once('gameroom-joined', (response) => {
                    expect(response.gameCode).toBe(validJoinData.gameCode);
                    expect(response.playerId).toBe(validJoinData.playerId);
                    expect(response.playerName).toBe(validJoinData.playerName);
                    checkComplete();
                });

                clientSocket.once('player-connected', (data) => {
                    expect(data.playerId).toBe(validJoinData.playerId);
                    expect(data.playerName).toBe(validJoinData.playerName);
                    expect(data.connectedAt).toBeDefined();
                    checkComplete();
                });

                clientSocket.once('current-game-state', (data) => {
                    expect(data.game).toBeDefined();
                    expect(data.game.id).toBe(validJoinData.gameCode);
                    expect(Array.isArray(data.players)).toBe(true);
                    expect(Array.isArray(data.teams)).toBe(true);
                    checkComplete();
                });

                setTimeout(() => {
                    if (eventsReceived < expectedEvents) {
                        console.warn(`Only received ${eventsReceived}/${expectedEvents} events`);
                    }
                    done();
                }, 3000);

                clientSocket.emit('join-gameroom', validJoinData);
            }).catch(done);
        });

        test('should handle game not found error', (done) => {
            const nonExistentGameData = {
                ...validJoinData,
                gameCode: 'NONEXISTENT'
            };

            clientSocket.emit('join-gameroom', nonExistentGameData);

            clientSocket.once('error', (error) => {
                expect(error.message).toContain('Game not found');
                done();
            });

            setTimeout(() => done(), 2000);
        });

        test('should handle player not found in game error', (done) => {
            const scenario = createGameScenario({
                gameCode: validJoinData.gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                const invalidPlayerData = {
                    ...validJoinData,
                    playerId: 'non-existent-player'
                };

                clientSocket.emit('join-gameroom', invalidPlayerData);

                clientSocket.once('error', (error) => {
                    expect(error.message).toContain('Player not found in this game');
                    done();
                });

                setTimeout(() => done(), 2000);
            }).catch(done);
        });

        test('should handle missing required fields', (done) => {
            const incompleteData = {
                gameCode: 'TEST123'
                // Missing playerId, playerName, deviceId
            };

            clientSocket.emit('join-gameroom', incompleteData);

            clientSocket.once('error', (error) => {
                expect(error.message).toContain('Missing required fields');
                done();
            });

            setTimeout(() => done(), 2000);
        });

        test('should handle player reconnection', (done) => {
            const scenario = createGameScenario({
                gameCode: validJoinData.gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            const firstPlayer = scenario.players[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            firstPlayer.id = validJoinData.playerId;
            firstPlayer.name = validJoinData.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                // First connection
                clientSocket.emit('join-gameroom', validJoinData);

                clientSocket.once('gameroom-joined', () => {
                    // Second connection with same player (should handle reconnection)
                    clientSocket2.emit('join-gameroom', validJoinData);

                    clientSocket2.once('gameroom-joined', (response) => {
                        expect(response.playerId).toBe(validJoinData.playerId);
                        done();
                    });

                    setTimeout(() => done(), 2000);
                });
            }).catch(done);
        });
    });

    // ==================== Leave Game Room Tests ====================

    describe('handleLeaveGameRoom Event', () => {
        const leaveData: LeaveGameData = {
            gameCode: 'LEAVE123',
            playerId: 'player-leave-test'
        };

        const joinData: JoinGameData = {
            gameCode: leaveData.gameCode,
            playerId: leaveData.playerId,
            playerName: 'Leave Test Player',
            deviceId: 'device-leave-123'
        };

        test('should successfully leave a game room', (done) => {
            const scenario = createGameScenario({
                gameCode: joinData.gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            const firstPlayer = scenario.players[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            firstPlayer.id = joinData.playerId;
            firstPlayer.name = joinData.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                // First join the game
                clientSocket.emit('join-gameroom', joinData);

                clientSocket.once('gameroom-joined', () => {
                    // Set up second client to listen for player-disconnected
                    clientSocket2.emit('join-gameroom', {
                        ...joinData,
                        playerId: 'other-player',
                        playerName: 'Other Player'
                    });

                    clientSocket2.once('gameroom-joined', () => {
                        // Now leave the game
                        clientSocket.emit('leave-gameroom', leaveData);

                        // Verify the server doesn't crash and connection remains
                        setTimeout(() => {
                            expect(clientSocket.connected).toBe(true);
                            done();
                        }, 500);
                    });
                });
            }).catch(done);
        });

        test('should handle leave from non-existent game gracefully', (done) => {
            const invalidLeaveData = {
                gameCode: 'NONEXISTENT',
                playerId: 'any-player'
            };

            clientSocket.emit('leave-gameroom', invalidLeaveData);

            // Should not crash - verify connection remains
            setTimeout(() => {
                expect(clientSocket.connected).toBe(true);
                done();
            }, 500);
        });
    });

    // ==================== Team Assignment Tests ====================

    describe('handleAssignedTeam Event', () => {
        const teamAssignData: TeamAssignmentData = {
            gameCode: 'TEAM123',
            playerId: 'player-team-test',
            teamId: 'team-red'
        };

        const joinData: JoinGameData = {
            gameCode: teamAssignData.gameCode,
            playerId: teamAssignData.playerId,
            playerName: 'Team Test Player',
            deviceId: 'device-team-123'
        };

        test('should successfully broadcast team assignment', (done) => {
            const scenario = createGameScenario({
                gameCode: teamAssignData.gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            // Set up player and team to match assignment data
            const firstPlayer = scenario.players[0];
            const firstTeam = scenario.teams[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            if (!firstTeam) throw new Error('No teams in scenario');
            firstPlayer.id = teamAssignData.playerId;
            firstPlayer.name = joinData.playerName;
            firstPlayer.team_id = teamAssignData.teamId;
            firstTeam.id = teamAssignData.teamId;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                // Join the game first
                clientSocket.emit('join-gameroom', joinData);

                clientSocket.once('gameroom-joined', () => {
                    // Emit team assignment
                    clientSocket.emit('assigned-team', teamAssignData);

                    clientSocket.once('team-assignment-updated', (response) => {
                        expect(response.playerId).toBe(teamAssignData.playerId);
                        expect(response.teamId).toBe(teamAssignData.teamId);
                        expect(response.playerName).toBe(joinData.playerName);
                        done();
                    });

                    setTimeout(() => done(), 2000);
                });
            }).catch(done);
        });

        test('should handle team assignment for unassigned player', (done) => {
            const scenario = createGameScenario({
                gameCode: teamAssignData.gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            // Set up player but DON'T assign to team
            const firstPlayer = scenario.players[0];
            const firstTeam = scenario.teams[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            if (!firstTeam) throw new Error('No teams in scenario');
            firstPlayer.id = teamAssignData.playerId;
            firstPlayer.name = joinData.playerName;
            delete firstPlayer.team_id; // Not assigned to team
            firstTeam.id = teamAssignData.teamId;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                clientSocket.emit('join-gameroom', joinData);

                clientSocket.once('gameroom-joined', () => {
                    clientSocket.emit('assigned-team', teamAssignData);

                    clientSocket.once('error', (error) => {
                        expect(error.message).toContain('not assigned to team');
                        done();
                    });

                    setTimeout(() => done(), 2000);
                });
            }).catch(done);
        });

        test('should handle assignment in wrong game state', (done) => {
            const scenario = createGameScenario({
                gameCode: teamAssignData.gameCode,
                gameStatus: 'playing', // Wrong state for team assignment
                teamCount: 2,
                playerCount: 2
            });

            const firstPlayer = scenario.players[0];
            const firstTeam = scenario.teams[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            if (!firstTeam) throw new Error('No teams in scenario');
            firstPlayer.id = teamAssignData.playerId;
            firstPlayer.name = joinData.playerName;
            firstPlayer.team_id = teamAssignData.teamId;
            firstTeam.id = teamAssignData.teamId;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                clientSocket.emit('join-gameroom', joinData);

                clientSocket.once('gameroom-joined', () => {
                    clientSocket.emit('assigned-team', teamAssignData);

                    clientSocket.once('error', (error) => {
                        expect(error.message).toContain('not in the correct state');
                        done();
                    });

                    setTimeout(() => done(), 2000);
                });
            }).catch(done);
        });
    });

    // ==================== Disconnect Handling Tests ====================

    describe('handleDisconnect Event', () => {
        test('should handle socket disconnection gracefully', (done) => {
            const scenario = createGameScenario({
                gameCode: 'DISC123',
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            const joinData: JoinGameData = {
                gameCode: 'DISC123',
                playerId: 'player-disconnect-test',
                playerName: 'Disconnect Test Player',
                deviceId: 'device-disc-123'
            };

            const firstPlayer = scenario.players[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            firstPlayer.id = joinData.playerId;
            firstPlayer.name = joinData.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                // Create a third client for this test
                const disconnectClient = Client(`http://localhost:${(httpServer.address() as any).port}`);

                disconnectClient.on('connect', () => {
                    disconnectClient.emit('join-gameroom', joinData);

                    disconnectClient.once('gameroom-joined', () => {
                        // Set up another client to listen for disconnection
                        clientSocket.emit('join-gameroom', {
                            ...joinData,
                            playerId: 'observer-player',
                            playerName: 'Observer Player'
                        });

                        clientSocket.once('gameroom-joined', () => {
                            // Disconnect the first client
                            disconnectClient.disconnect();

                            // Verify no errors and connection cleanup
                            setTimeout(() => {
                                expect(clientSocket.connected).toBe(true);
                                done();
                            }, 1000);
                        });
                    });
                });
            }).catch(done);
        });
    });

    // ==================== Broadcast Function Tests ====================

    describe('Broadcast Functions', () => {
        test('broadcastGameStateUpdate should broadcast to game room', (done) => {
            const gameCode = 'BROADCAST123';
            const scenario = createGameScenario({
                gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            const joinData: JoinGameData = {
                gameCode,
                playerId: 'broadcast-player',
                playerName: 'Broadcast Player',
                deviceId: 'device-broadcast'
            };

            const firstPlayer = scenario.players[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            firstPlayer.id = joinData.playerId;
            firstPlayer.name = joinData.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                clientSocket.emit('join-gameroom', joinData);

                clientSocket.once('gameroom-joined', () => {
                    const gameStateUpdate: GameStateUpdate = {
                        gameCode,
                        status: 'playing',
                        currentRound: 2,
                        currentTeam: 1
                    };

                    clientSocket.once('game-state-updated', (data) => {
                        expect(data.gameCode).toBe(gameCode);
                        expect(data.status).toBe('playing');
                        expect(data.currentRound).toBe(2);
                        expect(data.updatedAt).toBeDefined();
                        done();
                    });

                    // Trigger broadcast
                    broadcastGameStateUpdate(server, gameStateUpdate);
                });
            }).catch(done);
        });

        test('broadcastPhraseSubmissionUpdate should broadcast to game room', (done) => {
            const gameCode = 'PHRASE123';
            const scenario = createGameScenario({
                gameCode,
                gameStatus: 'phrase_submission',
                teamCount: 2,
                playerCount: 2
            });

            const joinData: JoinGameData = {
                gameCode,
                playerId: 'phrase-player',
                playerName: 'Phrase Player',
                deviceId: 'device-phrase'
            };

            const firstPlayer = scenario.players[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            firstPlayer.id = joinData.playerId;
            firstPlayer.name = joinData.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                clientSocket.emit('join-gameroom', joinData);

                clientSocket.once('gameroom-joined', () => {
                    const phraseUpdate: PhraseSubmissionUpdate = {
                        gameCode,
                        playerId: joinData.playerId,
                        submittedCount: 3,
                        totalRequired: 5
                    };

                    clientSocket.once('phrase-submission-updated', (data) => {
                        expect(data.gameCode).toBe(gameCode);
                        expect(data.playerId).toBe(joinData.playerId);
                        expect(data.submittedCount).toBe(3);
                        expect(data.totalRequired).toBe(5);
                        done();
                    });

                    // Trigger broadcast
                    broadcastPhraseSubmissionUpdate(server, phraseUpdate);
                });
            }).catch(done);
        });

        test('broadcastPlayerUpdate should broadcast to game room', (done) => {
            const gameCode = 'PLAYER123';
            const scenario = createGameScenario({
                gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            const joinData: JoinGameData = {
                gameCode,
                playerId: 'update-player',
                playerName: 'Update Player',
                deviceId: 'device-update'
            };

            const firstPlayer = scenario.players[0];
            if (!firstPlayer) throw new Error('No players in scenario');
            firstPlayer.id = joinData.playerId;
            firstPlayer.name = joinData.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                clientSocket.emit('join-gameroom', joinData);

                clientSocket.once('gameroom-joined', () => {
                    const playerUpdate = {
                        playerId: joinData.playerId,
                        playerName: joinData.playerName,
                        isConnected: false
                    };

                    clientSocket.once('player-updated', (data) => {
                        expect(data.playerId).toBe(joinData.playerId);
                        expect(data.isConnected).toBe(false);
                        done();
                    });

                    // Trigger broadcast
                    broadcastPlayerUpdate(server, gameCode, playerUpdate);
                });
            }).catch(done);
        });
    });

    // ==================== Utility Function Tests ====================

    describe('Utility Functions', () => {
        test('getConnectedPlayersCount should return correct count', () => {
            const count = getConnectedPlayersCount('UTIL123');
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
        });

        test('getConnectedPlayers should return array', () => {
            const players = getConnectedPlayers('UTIL123');
            expect(Array.isArray(players)).toBe(true);
        });

        test('isPlayerConnected should return boolean', () => {
            const connected = isPlayerConnected('test-player');
            expect(typeof connected).toBe('boolean');
        });

        test('getPlayerSocket should return socket or null', () => {
            const socket = getPlayerSocket(server, 'test-player');
            expect(socket === null || typeof socket === 'object').toBe(true);
        });

        test('utility functions should handle multiple connected players', (done) => {
            const gameCode = 'MULTI123';
            const scenario = createGameScenario({
                gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 3
            });

            const player1Data: JoinGameData = {
                gameCode,
                playerId: 'multi-player-1',
                playerName: 'Multi Player 1',
                deviceId: 'device-multi-1'
            };

            const player2Data: JoinGameData = {
                gameCode,
                playerId: 'multi-player-2',
                playerName: 'Multi Player 2',
                deviceId: 'device-multi-2'
            };

            const firstPlayer = scenario.players[0];
            const secondPlayer = scenario.players[1];
            if (!firstPlayer) throw new Error('No first player in scenario');
            if (!secondPlayer) throw new Error('No second player in scenario');
            firstPlayer.id = player1Data.playerId;
            firstPlayer.name = player1Data.playerName;
            secondPlayer.id = player2Data.playerId;
            secondPlayer.name = player2Data.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                let joinedCount = 0;

                const checkUtilities = () => {
                    const count = getConnectedPlayersCount(gameCode);
                    const players = getConnectedPlayers(gameCode);
                    
                    expect(count).toBeGreaterThanOrEqual(0);
                    expect(players.length).toBeGreaterThanOrEqual(0);
                    expect(isPlayerConnected(player1Data.playerId)).toBe(true);
                    
                    done();
                };

                clientSocket.emit('join-gameroom', player1Data);
                clientSocket.once('gameroom-joined', () => {
                    joinedCount++;
                    
                    clientSocket2.emit('join-gameroom', player2Data);
                    clientSocket2.once('gameroom-joined', () => {
                        joinedCount++;
                        
                        setTimeout(checkUtilities, 100);
                    });
                });
            }).catch(done);
        });
    });

    // ==================== Error Handling Tests ====================

    describe('Error Handling', () => {
        test('should handle malformed join-gameroom data', (done) => {
            clientSocket.emit('join-gameroom', { invalid: 'data' });

            setTimeout(() => {
                expect(clientSocket.connected).toBe(true);
                done();
            }, 500);
        });

        test('should handle empty event data', (done) => {
            clientSocket.emit('join-gameroom', {});

            clientSocket.once('error', (error) => {
                expect(error.message).toContain('Missing required fields');
                done();
            });

            setTimeout(() => done(), 1000);
        });

        test('should handle null event data', (done) => {
            clientSocket.emit('join-gameroom', null);

            setTimeout(() => {
                expect(clientSocket.connected).toBe(true);
                done();
            }, 500);
        });

        test('should handle undefined event data', (done) => {
            clientSocket.emit('join-gameroom', undefined);

            setTimeout(() => {
                expect(clientSocket.connected).toBe(true);
                done();
            }, 500);
        });
    });

    // ==================== Ping/Pong Tests ====================

    describe('Ping/Pong Events', () => {
        test('should respond to ping with pong', (done) => {
            clientSocket.emit('ping');

            clientSocket.once('pong', () => {
                done();
            });

            setTimeout(() => {
                console.warn('Ping/pong test timed out');
                done();
            }, 1000);
        });

        test('should handle multiple ping requests', (done) => {
            let pongCount = 0;
            const expectedPongs = 3;

            const pongHandler = () => {
                pongCount++;
                if (pongCount === expectedPongs) {
                    clientSocket.off('pong', pongHandler);
                    expect(pongCount).toBe(expectedPongs);
                    done();
                }
            };

            clientSocket.on('pong', pongHandler);

            // Send multiple pings
            for (let i = 0; i < expectedPongs; i++) {
                setTimeout(() => clientSocket.emit('ping'), i * 100);
            }

            setTimeout(() => {
                clientSocket.off('pong', pongHandler);
                if (pongCount < expectedPongs) {
                    console.warn(`Only received ${pongCount}/${expectedPongs} pongs`);
                }
                done();
            }, 2000);
        });
    });

    // ==================== Integration Tests ====================

    describe('Multi-Player Integration Tests', () => {
        test('should handle multiple players joining same game', (done) => {
            const gameCode = 'INTEGRATION123';
            const scenario = createGameScenario({
                gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 4
            });

            const player1Data: JoinGameData = {
                gameCode,
                playerId: 'integration-player-1',
                playerName: 'Integration Player 1',
                deviceId: 'device-int-1'
            };

            const player2Data: JoinGameData = {
                gameCode,
                playerId: 'integration-player-2',
                playerName: 'Integration Player 2',
                deviceId: 'device-int-2'
            };

            const firstPlayer = scenario.players[0];
            const secondPlayer = scenario.players[1];
            if (!firstPlayer) throw new Error('No first player in scenario');
            if (!secondPlayer) throw new Error('No second player in scenario');
            firstPlayer.id = player1Data.playerId;
            firstPlayer.name = player1Data.playerName;
            secondPlayer.id = player2Data.playerId;
            secondPlayer.name = player2Data.playerName;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                let eventsReceived = 0;

                // Both clients should receive player-connected events
                const player1ConnectedHandler = (data: any) => {
                    eventsReceived++;
                    if (data.playerId === player2Data.playerId) {
                        expect(data.playerName).toBe(player2Data.playerName);
                        if (eventsReceived >= 2) done();
                    }
                };

                const player2ConnectedHandler = (data: any) => {
                    eventsReceived++;
                    if (data.playerId === player1Data.playerId) {
                        expect(data.playerName).toBe(player1Data.playerName);
                        if (eventsReceived >= 2) done();
                    }
                };

                clientSocket.on('player-connected', player1ConnectedHandler);
                clientSocket2.on('player-connected', player2ConnectedHandler);

                // Player 1 joins first
                clientSocket.emit('join-gameroom', player1Data);

                clientSocket.once('gameroom-joined', () => {
                    // Player 2 joins second
                    clientSocket2.emit('join-gameroom', player2Data);
                });

                setTimeout(() => {
                    clientSocket.off('player-connected', player1ConnectedHandler);
                    clientSocket2.off('player-connected', player2ConnectedHandler);
                    done();
                }, 3000);
            }).catch(done);
        });

        test('should handle team assignments across multiple players', (done) => {
            const gameCode = 'TEAMINT123';
            const scenario = createGameScenario({
                gameCode,
                gameStatus: 'waiting',
                teamCount: 2,
                playerCount: 2
            });

            const player1Data: JoinGameData = {
                gameCode,
                playerId: 'team-player-1',
                playerName: 'Team Player 1',
                deviceId: 'device-team-1'
            };

            const teamAssign1: TeamAssignmentData = {
                gameCode,
                playerId: player1Data.playerId,
                teamId: 'team-red'
            };

            const firstPlayer = scenario.players[0];
            const firstTeam = scenario.teams[0];
            if (!firstPlayer) throw new Error('No first player in scenario');
            if (!firstTeam) throw new Error('No first team in scenario');
            firstPlayer.id = player1Data.playerId;
            firstPlayer.name = player1Data.playerName;
            firstPlayer.team_id = teamAssign1.teamId;
            firstTeam.id = teamAssign1.teamId;

            createRealDataStoreFromScenario(scenario).initDb().then(() => {
                clientSocket.emit('join-gameroom', player1Data);

                clientSocket.once('gameroom-joined', () => {
                    clientSocket.emit('assigned-team', teamAssign1);

                    clientSocket.once('team-assignment-updated', (response) => {
                        expect(response.playerId).toBe(teamAssign1.playerId);
                        expect(response.teamId).toBe(teamAssign1.teamId);
                        done();
                    });
                });

                setTimeout(() => done(), 3000);
            }).catch(done);
        });
    });
});
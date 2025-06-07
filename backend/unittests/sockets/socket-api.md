# Unit Testing Plan for SOCKET-API.ts

## Test Setup and Configuration

- [x] 1. Create test file `SOCKET-API.test.ts` in `backend/unittests/sockets/`
- [x] 2. Import required dependencies
  - [x] 2.1. Import Socket.IO server and client for testing
  - [x] 2.2. Import `createRealDataStoreFromScenario` from `realDbUtils.ts`
  - [x] 2.3. Import factories from `test-factories.ts`
  - [x] 2.4. Import test helpers from `test-helpers.ts`
  - [x] 2.5. Import all exported functions from `SOCKET-API.ts`
- [x] 3. Setup test environment
  - [x] 3.1. Initialize test database before all tests
  - [x] 3.2. Create Socket.IO server instance for testing
  - [x] 3.3. Create helper function to create connected socket clients
  - [x] 3.4. Setup cleanup after each test (reset database, disconnect sockets)

## Event Handler Tests

### handleJoinGameRoom Tests

- [x] 4. Test successful game room join
  - [x] 4.1. Create game scenario with `createGameSetup` factory
  - [x] 4.2. Setup database with `createRealDataStoreFromScenario`
  - [x] 4.3. Create socket connection and emit 'join-gameroom' event
  - [x] 4.4. Assert 'gameroom-joined' event is emitted to joining player
  - [ ] 4.5. Assert 'player-connected' event is broadcast to game room
  - [x] 4.6. Assert 'current-game-state' event is sent to joining player
  - [x] 4.7. Verify player connection status is updated in database
- [x] 5. Test validation failures
  - [x] 5.1. Test missing required fields (gameCode, playerId, playerName, deviceId)
  - [x] 5.2. Test with non-existent game
  - [x] 5.3. Test with player not in game
  - [x] 5.4. Test with invalid player ID for game
- [ ] 6. Test reconnection scenarios
  - [ ] 6.1. Test replacing existing socket connection for same player
  - [ ] 6.2. Test reconnection from same device
  - [ ] 6.3. Test connection from different device
  - [ ] 6.4. Verify old socket receives 'connection-replaced' event
  - [ ] 6.5. Verify old device session is deactivated

### handleLeaveGameRoom Tests

- [ ] 7. Test successful game room leave
  - [ ] 7.1. Setup connected player in game room
  - [ ] 7.2. Emit 'leave-gameroom' event
  - [ ] 7.3. Assert 'player-disconnected' broadcast to remaining players
  - [ ] 7.4. Verify player connection status updated to false in database
  - [ ] 7.5. Verify socket leaves the game room
- [ ] 8. Test validation failures
  - [ ] 8.1. Test with non-existent player connection
  - [ ] 8.2. Test with game code mismatch
  - [ ] 8.3. Test with invalid player ID

### handleDisconnect Tests

- [ ] 9. Test automatic disconnect handling
  - [ ] 9.1. Setup connected player
  - [ ] 9.2. Simulate socket disconnect with various reasons
    - [ ] 9.2.1. "transport close"
    - [ ] 9.2.2. "client namespace disconnect"
    - [ ] 9.2.3. "ping timeout"
    - [ ] 9.2.4. "transport error"
  - [ ] 9.3. Verify 'player-disconnected' broadcast
  - [ ] 9.4. Verify player status updated in database
  - [ ] 9.5. Verify device session deactivated
  - [ ] 9.6. Verify connection tracking cleaned up

### handleAssignedTeam Tests

- [ ] 10. Test successful team assignment broadcast
  - [ ] 10.1. Create game in 'waiting' status with teams
  - [ ] 10.2. Create player already assigned to team
  - [ ] 10.3. Emit 'assigned-team' event
  - [ ] 10.4. Assert 'team-assignment-updated' broadcast to game room
- [ ] 11. Test validation failures
  - [ ] 11.1. Test with non-existent game
  - [ ] 11.2. Test with game not in valid status (not 'waiting' or 'phrase_submission')
  - [ ] 11.3. Test with non-existent player
  - [ ] 11.4. Test with non-existent team
  - [ ] 11.5. Test with player not assigned to specified team

## Broadcast Function Tests

### broadcastGameStateUpdate Tests

- [ ] 12. Test game state update broadcast
  - [ ] 12.1. Setup multiple connected players in game
  - [ ] 12.2. Call `broadcastGameStateUpdate` with various updates
    - [ ] 12.2.1. Status change
    - [ ] 12.2.2. Round change
    - [ ] 12.2.3. Team change
    - [ ] 12.2.4. Timer state change
  - [ ] 12.3. Verify all players receive 'game-state-updated' event
  - [ ] 12.4. Verify event payload contains correct data and timestamp

### broadcastPhraseSubmissionUpdate Tests

- [ ] 13. Test phrase submission update broadcast
  - [ ] 13.1. Setup game in 'phrase_submission' status
  - [ ] 13.2. Call `broadcastPhraseSubmissionUpdate`
  - [ ] 13.3. Verify all players receive 'phrase-submission-updated' event
  - [ ] 13.4. Verify payload contains player progress data

### broadcastPlayerUpdate Tests

- [ ] 14. Test player update broadcast
  - [ ] 14.1. Setup game with multiple players
  - [ ] 14.2. Call `broadcastPlayerUpdate` with various updates
  - [ ] 14.3. Verify all players receive 'player-updated' event
  - [ ] 14.4. Verify payload contains correct update data

## Utility Function Tests

### getConnectedPlayersCount Tests

- [ ] 15. Test connected player counting
  - [ ] 15.1. Test with no connected players
  - [ ] 15.2. Test with single connected player
  - [ ] 15.3. Test with multiple connected players in same game
  - [ ] 15.4. Test with players in different games

### getConnectedPlayers Tests

- [ ] 16. Test retrieving connected players list
  - [ ] 16.1. Test empty list when no players connected
  - [ ] 16.2. Test retrieving all players for specific game
  - [ ] 16.3. Test filtering excludes players from other games
  - [ ] 16.4. Verify returned player objects contain all required fields

### isPlayerConnected Tests

- [ ] 17. Test player connection status check
  - [ ] 17.1. Test returns true for connected player
  - [ ] 17.2. Test returns false for disconnected player
  - [ ] 17.3. Test returns false for non-existent player

### getPlayerSocket Tests

- [ ] 18. Test retrieving player socket
  - [ ] 18.1. Test returns socket for connected player
  - [ ] 18.2. Test returns null for disconnected player
  - [ ] 18.3. Test returns null for non-existent player

## Socket Event Registration Tests

### registerSocketHandlers Tests

- [ ] 19. Test socket handler registration
  - [ ] 19.1. Verify all event handlers are registered
    - [ ] 19.1.1. 'join-gameroom'
    - [ ] 19.1.2. 'leave-gameroom'
    - [ ] 19.1.3. 'assigned-team'
    - [ ] 19.1.4. 'disconnect'
    - [ ] 19.1.5. 'reconnect-session'
    - [ ] 19.1.6. 'generate-device-id'
    - [ ] 19.1.7. 'ping'
  - [ ] 19.2. Test device session reconnection
    - [ ] 19.2.1. Test successful reconnection with existing session
    - [ ] 19.2.2. Test failed reconnection with no session
    - [ ] 19.2.3. Test auto-rejoin after successful reconnection
  - [ ] 19.3. Test device ID generation
    - [ ] 19.3.1. Verify 'device-id-generated' event emitted
    - [ ] 19.3.2. Verify generated ID format
  - [ ] 19.4. Test ping/pong heartbeat
    - [ ] 19.4.1. Test without device ID
    - [ ] 19.4.2. Test with device ID updates last seen
    - [ ] 19.4.3. Verify 'pong' response

## Integration Tests

- [ ] 20. Test complete game flow scenarios
  - [ ] 20.1. Test multiple players joining and leaving
  - [ ] 20.2. Test team assignment flow
  - [ ] 20.3. Test reconnection after network interruption
  - [ ] 20.4. Test concurrent connections from same player

## Edge Cases and Error Handling

- [ ] 21. Test error scenarios
  - [ ] 21.1. Database transaction failures
  - [ ] 21.2. Socket.IO communication errors
  - [ ] 21.3. Race conditions with simultaneous operations
  - [ ] 21.4. Memory cleanup on unexpected errors

## Performance Tests

- [ ] 22. Test performance and scalability
  - [ ] 22.1. Test with large number of connected players
  - [ ] 22.2. Test broadcast performance with many recipients
  - [ ] 22.3. Verify memory usage with connection tracking
  - [ ] 22.4. Test stale session cleanup interval
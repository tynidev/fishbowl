# Cleanup SOCKET API

The Socket API (`backend\src\sockets\SOCKET-API.ts`) requires cleanup and consolidation. Several routes may be redundant or unnecessary and should be evaluated for removal.

## Current Real-time Events

### Client-to-Server Events (Socket.IO)
- `join-gameroom` - Player joins game room for real-time updates
- `leave-gameroom` - Player leaves game room
- `assigned-team` - Broadcast team assignment changes
- `reconnect-session` - Reconnect with existing device session
- `generate-device-id` - Request new device ID generation
- `ping` - Heartbeat/connection monitoring with device session update
- `disconnect` - Auto-triggered on connection loss

### Server-to-Client Events (Socket.IO)
- `gameroom-joined` - Confirms player joined game room
- `player-connected` - Notifies when player connects to game
- `player-disconnected` - Notifies when player disconnects from game
- `current-game-state` - Sends full game state to newly connected player
- `game-state-updated` - Broadcasts game state changes (status, round, team, timer)
- `phrase-submission-updated` - Broadcasts phrase submission progress
- `player-updated` - Broadcasts player-specific updates
- `team-assignment-updated` - Broadcasts team assignment changes
- `game:started` - Notifies when game starts
- `connection-replaced` - Notifies when connection is replaced by new device
- `session-reconnected` - Response to device session reconnection attempt
- `device-id-generated` - Returns newly generated device ID
- `pong` - Response to ping heartbeat
- `error` - Error messages for failed operations
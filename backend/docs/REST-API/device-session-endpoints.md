# 📱Device Session Endpoints

Device session endpoints manage device identification, session tracking, and connection monitoring across the Fishbowl application.

[← Back to API Documentation](./README.md)

## Endpoints

### <span style="color: orange;">GET /api/device-sessions/generate-id</span>
Generates a new unique device ID for session tracking.

**Features:**
- Automatic device ID generation with uniqueness validation

**Response:**
```typescript
{
  success: boolean;                    // Operation status
  deviceId: string;                    // Generated device ID
}
```

### <span style="color: orange;">GET /api/device-sessions/:deviceId</span>
Retrieves device session information with optional game context.

**Features:**
- Links device sessions to player accounts
- Maintains connection status for real-time updates
- Tracks team assignments and game participation

**Query Parameters:**
- `gameId` - Optional: Filter session by specific game

**Response:**
```typescript
{
  success: boolean;                    // Operation status
  session: {
    id: string;                        // Session UUID
    deviceId: string;                  // Device identifier
    socketId: string | null;           // WebSocket connection ID
    lastSeen: string;                  // Last activity timestamp
    isActive: boolean;                 // Session status
    createdAt: string;                 // Creation timestamp
    updatedAt: string;                 // Last update timestamp
  };
  player: {                            // Player info (if session has player)
    id: string;                        // Player UUID
    name: string;                      // Player name
    gameId: string;                    // Associated game ID
    teamId: string | null;             // Team assignment
    isConnected: boolean;              // Connection status
  } | null;
  game: {                              // Game info (if session has game)
    id: string;                        // Game code
    name: string;                      // Game name
    status: string;                    // Game status
    hostPlayerId: string;              // Host player UUID
  } | null;
}
```

### <span style="color: orange;">GET /api/device-sessions/:deviceId/active/:gameId</span>
Checks if a device has an active session for a specific game.

**Features:**
- Associates sessions with specific games
- Enables game-specific session queries

**Response:**
```typescript
{
  success: boolean;                    // Operation status
  hasActiveSession: boolean;           // Whether device has active session
}
```

### <span style="color: orange;">GET /api/device-sessions/game/:gameId/active</span>
Retrieves all active sessions for a specific game.

**Features:**
- Provides session analytics for game hosts
- Session tracking across WebSocket connections

**Response:**
```typescript
{
  success: boolean;                    // Operation status
  gameId: string;                      // Game identifier
  activeSessions: Array<{
    id: string;                        // Session UUID
    deviceId: string;                  // Device identifier
    socketId: string | null;           // WebSocket connection ID
    lastSeen: string;                  // Last activity timestamp
    isActive: boolean;                 // Session status
    player: {                          // Player info (if available)
      id: string;                      // Player UUID
      name: string;                    // Player name
      gameId: string;                  // Associated game ID
      teamId: string | null;           // Team assignment
      isConnected: boolean;            // Connection status
    } | null;
  }>;
  count: number;                       // Number of active sessions
}
```

### <span style="color: orange;">POST /api/device-sessions/:deviceId/deactivate</span>
Deactivates a device session, optionally for a specific game.

**Features:**
- Supports player reconnection with existing sessions
- Support for multiple sessions per device across different games
- Supports multi-game session management

**Request Body:**
```typescript
{
  gameId?: string;                     // Optional: Specific game to deactivate from
}
```

**Response:**
```typescript
{
  success: boolean;                    // Operation status
  message: string;                     // Success message
}
```

### <span style="color: orange;">POST /api/device-sessions/admin/cleanup</span>
Administrative endpoint to cleanup stale and old sessions.

**Features:**
- Bulk session cleanup operations
- Stale session detection and removal
- Session monitoring and diagnostics
- Performance optimization through session management
- Automatic cleanup of stale and disconnected sessions

**Response:**
```typescript
{
  success: boolean;                    // Operation status
  message: string;                     // Success message
  staleSessionsDeactivated: number;    // Number of stale sessions deactivated
  oldSessionsRemoved: number;          // Number of old sessions removed
}
```

## Session Management Features

### Device Identification
- **Unique Device IDs**: Automatic generation of unique device identifiers
- **Cross-Game Tracking**: Support for multiple sessions per device across different games
- **Persistent Sessions**: Maintain session state across reconnections

### Connection Monitoring
- **Real-time Status**: Live tracking of connection status via WebSocket integration
- **Activity Tracking**: Last seen timestamps for session management
- **Automatic Cleanup**: Stale session detection and removal

### Multi-Game Support
- **Game-Specific Sessions**: Associate sessions with specific games
- **Session Analytics**: Comprehensive session tracking for game hosts
- **Reconnection Support**: Enable seamless player reconnection

### Administrative Features
- **Bulk Operations**: Administrative cleanup of stale and old sessions
- **Performance Optimization**: Session management for system performance
- **Monitoring**: Session diagnostics and monitoring capabilities

## Related Documentation

- [Game Endpoints](./game-endpoints.md) - Games that sessions are associated with
- [Player Endpoints](./player-endpoints.md) - Players linked to device sessions
- [WebSocket API](../sockets/SOCKET-API.md) - Real-time connection management

[← Back to API Documentation](./README.md)

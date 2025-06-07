# 👥 Player Endpoints

Player endpoints handle player registration, team management, and player status tracking within games.

[← Back to API Documentation](../README.md)

## Endpoints

### <span style="color: orange;">POST /api/games/:gameCode/join</span>
Allows a player to join an existing game.

**Features:**
- Validates player names (1-20 characters, alphanumeric + basic punctuation)
- Supports player reconnection with existing names
- Automatically assigns players to teams using round-robin
- Creates default teams with colors and names
- Automatically balances players across teams

**Request Body:**
```typescript
{
  playerName: string;              // Required: Player name (1-20 characters)
}
```

**Response:**
```typescript
{
  playerId: string;                // Player UUID
  playerName: string;              // Player name
  teamId?: string;                 // Assigned team ID (if available)
  teamName?: string;               // Assigned team name (if available)
  gameInfo: {
    id: string;                    // Game code
    name: string;                  // Game name
    status: string;                // Game status
    playerCount: number;           // Current player count
    teamCount: number;             // Number of teams
    phrasesPerPlayer: number;      // Phrases per player
    timerDuration: number;         // Timer duration
  }
}
```

### <span style="color: orange;">GET /api/games/:gameCode/players</span>
Retrieves the list of players in a game.

**Response:**
```typescript
{
  players: Array<{
    id: string;                    // Player UUID
    name: string;                  // Player name
    teamId?: string;               // Team ID (if assigned)
    teamName?: string;             // Team name (if assigned)
    isConnected: boolean;          // Connection status
    joinedAt: string;              // Join timestamp
  }>;
  totalCount: number;              // Total player count
}
```

## Player Management Features

### Team Assignment
- **Automatic Balancing**: Players are automatically distributed across teams using round-robin assignment
- **Team Creation**: Default teams are created with predefined colors and names
- **Reconnection Support**: Existing players can reconnect and maintain their team assignments

### Validation
- **Name Requirements**: Player names must be 1-20 characters, alphanumeric with basic punctuation
- **Uniqueness**: Player names must be unique within each game
- **Status Tracking**: Real-time connection status monitoring

## Related Documentation

- [Game Endpoints](./game-endpoints.md) - Creating and configuring games
- [Phrase Endpoints](./phrase-endpoints.md) - Player phrase submissions
- [Device Sessions](./device-session-endpoints.md) - Player session management

[← Back to API Documentation](../README.md)

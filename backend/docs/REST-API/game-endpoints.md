# 🎮 Game Endpoints

Game endpoints provide functionality for creating, configuring, and managing Fishbowl games.

[← Back to API Documentation](../documentation.md)

## Endpoints

### <span style="color: orange;">POST /api/games</span>
Creates a new game with a host player.

**Features:**
- Generates unique 6-character alphanumeric codes
- Validates uniqueness before assigning
- Maximum 10 attempts to generate unique code
- Uses database transactions to ensure data consistency

**Request Body:**
```typescript
{
  name: string;                    // Required: Game name
  hostPlayerName: string;          // Required: Host player name
  teamCount?: number;              // Optional: Number of teams (2-8, default: 2)
  phrasesPerPlayer?: number;       // Optional: Phrases per player (3-10, default: 5)
  timerDuration?: number;          // Optional: Timer duration in seconds (30-180, default: 60)
}
```

**Response:**
```typescript
{
  gameCode: string;                // 6-character game code
  gameId: string;                  // Same as gameCode
  hostPlayerId: string;            // UUID of host player
  config: {
    name: string;
    teamCount: number;
    phrasesPerPlayer: number;
    timerDuration: number;
  }
}
```

### <span style="color: orange;">GET /api/games/:gameCode</span>
Retrieves information about a specific game.

**Response:**
```typescript
{
  id: string;                      // Game code
  name: string;                    // Game name
  status: string;                  // Game status
  hostPlayerId: string;            // Host player UUID
  teamCount: number;               // Number of teams
  phrasesPerPlayer: number;        // Phrases per player
  timerDuration: number;           // Timer duration
  currentRound: number;            // Current round number
  currentTeam: number;             // Current team number
  playerCount: number;             // Total player count
  createdAt: string;               // Creation timestamp
  startedAt?: string;              // Start timestamp (if started)
}
```

### <span style="color: orange;">PUT /api/games/:gameCode/config</span>
Updates game configuration (only available before game starts).

**Features:**
- Game configuration changes only allowed in 'waiting' status
- Supports team reconfiguration when team count changes
- Uses database transactions for data consistency

**Request Body:**
```typescript
{
  teamCount?: number;              // Optional: Number of teams (2-8)
  phrasesPerPlayer?: number;       // Optional: Phrases per player (3-10)
  timerDuration?: number;          // Optional: Timer duration (30-180 seconds)
}
```

**Response:**
Same as GET /api/games/:gameCode with updated values.

## Related Documentation

- [Player Endpoints](./player-endpoints.md) - Managing players within games
- [Phrase Endpoints](./phrase-endpoints.md) - Managing phrases for games
- [Device Sessions](./device-session-endpoints.md) - Session tracking for games

[← Back to API Documentation](../documentation.md)

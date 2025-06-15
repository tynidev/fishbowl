# 🎮 Game Endpoints

Game endpoints provide functionality for creating, configuring, and managing Fishbowl games.

[← Back to API Documentation](../README.md)

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
  id: string;                      // Game code
  name: string;                    // Game name
  status: 'setup' | 'playing' | 'finished';
  sub_status:
    // When status = 'setup'
    | 'waiting_for_players'       // Players joining, getting assigned to teams, submitting phrases
    | 'ready_to_start'            // All players joined, all phrases submitted, host can start
    
    // When status = 'playing'
    | 'round_intro'               // Showing round rules before starting
    | 'turn_starting'             // Brief moment between turns (showing whose turn)
    | 'turn_active'               // Active turn with timer running
    | 'turn_paused'               // Turn paused (disconnection, dispute, etc.)
    | 'round_complete'            // Round finished, showing scores before next round
    
    // When status = 'finished'
    | 'game_complete';            // Final scores, game over
  hostPlayerId: string;            // UUID of host player
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

### <span style="color: orange;">GET /api/games/:gameCode</span>
Retrieves information about a specific game.

**Response:**
```typescript
{
  id: string;                      // Game code
  name: string;                    // Game name
  status: 'setup' | 'playing' | 'finished';
  sub_status:
    // When status = 'setup'
    | 'waiting_for_players'       // Players joining, getting assigned to teams, submitting phrases
    | 'ready_to_start'            // All players joined, all phrases submitted, host can start
    
    // When status = 'playing'
    | 'round_intro'               // Showing round rules before starting
    | 'turn_starting'             // Brief moment between turns (showing whose turn)
    | 'turn_active'               // Active turn with timer running
    | 'turn_paused'               // Turn paused (disconnection, dispute, etc.)
    | 'round_complete'            // Round finished, showing scores before next round
    
    // When status = 'finished'
    | 'game_complete';            // Final scores, game over
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
- Game configuration changes only allowed in 'setup' status
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

### <span style="color: orange;">POST /api/games/:gameCode/start</span>
Starts a game after validation.

**Features:**
- Validates game is in 'setup' status
- Requires at least 2 * teamCount players
- All players must be assigned to teams
- Creates first turn and updates game status to 'playing'
- Shuffles players for random turn order
- Broadcasts game started event to all connected clients

**Validation Requirements:**
- Game must exist and be in 'setup' status
- Must have at least 2 players per team (2 * teamCount total)
- All players must be assigned to teams
- All required phrases should be submitted

**Response:**
```typescript
{
  id: string;                      // Game code
  name: string;                    // Game name
  status: 'setup' | 'playing' | 'finished';
  sub_status:
    // When status = 'setup'
    | 'waiting_for_players'       // Players joining, getting assigned to teams, submitting phrases
    | 'ready_to_start'            // All players joined, all phrases submitted, host can start
    
    // When status = 'playing'
    | 'round_intro'               // Showing round rules before starting
    | 'turn_starting'             // Brief moment between turns (showing whose turn)
    | 'turn_active'               // Active turn with timer running
    | 'turn_paused'               // Turn paused (disconnection, dispute, etc.)
    | 'round_complete'            // Round finished, showing scores before next round
    
    // When status = 'finished'
    | 'game_complete';            // Final scores, game over
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

## Related Documentation

- [Player Endpoints](./player-endpoints.md) - Managing players within games
- [Phrase Endpoints](./phrase-endpoints.md) - Managing phrases for games
- [Device Sessions](./device-session-endpoints.md) - Session tracking for games

[← Back to API Documentation](../README.md)

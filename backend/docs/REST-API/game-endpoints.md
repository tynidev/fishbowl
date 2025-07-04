# 🎮 Game Endpoints

Game endpoints provide functionality for creating, configuring, and managing Fishbowl games.

[← Back to API Documentation](./README.md)

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
- Creates circular linked list turn order using draft pattern
- Selects random starting player from turn order
- Creates first turn and updates game status to 'playing'
- Broadcasts game started event to all connected clients

**Turn Order Management:**
- Implements circular draft to ensure fair turn distribution
- Creates **circular linked list** for seamless turn progression
- Each player points to next and previous players in the turn sequence
- Turn order preserved across all 3 rounds of the game
- Random starting player selected from the established order

**Draft Pattern Example:**
With 3 teams (A, B, C) having 2 players each:
```
Round starts: A1 → B1 → C1 → A2 → B2 → C2 → A1 → B1...
```
This ensures balanced turn distribution and maintains fairness across teams.

**Validation Requirements:**
- Game must exist and be in 'setup' status
- Must have at least 2 players per team (2 * teamCount total)
- All players must be assigned to teams
- All required phrases must be submitted (players × phrasesPerPlayer)

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

### <span style="color: orange;">POST /api/games/:gameCode/rounds/start</span>
Starts a new round in a game that is in the 'round_intro' state.

**Features:**
- Validates game is in 'playing' status and 'round_intro' sub-status
- Creates the first turn for the round with the next player in turn order
- Resets all phrases back to 'active' state for the new round
- Updates game sub-status to 'turn_starting'
- Broadcasts round start event via Socket.IO to all connected clients

**Validation Requirements:**
- Game must exist and be in 'playing' status with 'round_intro' sub-status
- A valid player must be determined from the turn order

**Response:**
```typescript
{
  round: number;                   // Current round number (1-3)
  roundName: string;               // Round name ("Taboo", "Charades", "One Word")
  currentTurnId: string;           // UUID of the new turn
  currentPlayer: {
    id: string;                    // Player ID who will take the turn
    teamId: string;                // Team ID of the player
  };
  startedAt: string;               // ISO timestamp when the round started
}
```

## Related Documentation

- [Player Endpoints](./player-endpoints.md) - Managing players within games
- [Phrase Endpoints](./phrase-endpoints.md) - Managing phrases for games
- [Device Sessions](./device-session-endpoints.md) - Session tracking for games

[← Back to API Documentation](./README.md)

# Game State Management API Implementation Plan (with Socket.IO Integration)

## Overview
Implement three core game state management endpoints to `backend/src/controllers/game.ts` with real-time Socket.IO updates to all connected device sessions.d

```typescript
// Start the game
POST /api/games/:gameCode/start

// Start a new round
POST /api/games/:gameCode/rounds/start

// Get current game state
GET /api/games/:gameCode/state
```

## 1. POST /api/games/:gameCode/start

### Purpose
Transition game from `waiting` or `phrase_submission` to `playing` state and initialize first round.

### Implementation Steps

#### 1.1 Input Validation
```typescript
// No request body required
// Path parameter: gameCode (string)
```

#### 1.2 Authorization Check
- Verify request comes from a player in the game (using playerId from request headers/body)
- Return 403 if non-game player attempts to start

#### 1.3 Pre-conditions Validation
- Game exists and is in `waiting` or `phrase_submission` state
- Minimum players joined (at least 2 teams with 2+ players each)
- Minimum phrases submitted (configurable, default 3 per player)
- Teams are balanced

#### 1.4 Database Transaction
```typescript
// Within a single transaction:
1. Update games table:
   - status = 'playing'
   - started_at = NOW()
   - current_round = 1

2. Create first round in rounds table:
   - round_number = 1
   - round_type = 'TABOO' (or from game config)
   - started_at = NOW()
   - status = 'PENDING'

3. Initialize turn order:
   - Calculate team rotation
   - Set first acting team/player

4. Mark all submitted phrases as 'in_bowl':
   - Update phrases.status = 'in_bowl'
   - Set phrases.guessed = false
```

#### 1.5 Socket Event Emission
```typescript
// In the REST endpoint, after successful database update:
import { broadcastGameStateUpdate } from '../sockets/SOCKET-API';

// Emit to all connected device sessions
await broadcastGameStateUpdate(io, {
  gameCode,
  status: 'playing',
  currentRound: 1,
  currentTeam: firstActingTeam,
  currentPlayer: firstActingPlayer
});
```

#### 1.6 Socket Event Handler (Add to SOCKET-API.ts)
```typescript
// Add this interface to SOCKET-API.ts
export interface GameStartedData {
  gameCode: string;
  status: 'playing';
  currentRound: number;
  roundType: string;
  startedAt: Date;
  turnOrder: string[];
  firstActingTeam: string;
  firstActingPlayer: string;
}

// Add this broadcast function to SOCKET-API.ts
export async function broadcastGameStarted(
  io: SocketIOServer,
  data: GameStartedData
): Promise<void> {
  try {
    io.to(data.gameCode).emit('game:started', data);
    console.log(`Broadcasting game started for game ${data.gameCode}`);
  } catch (error) {
    console.error('Error broadcasting game started:', error);
  }
}
```

#### 1.7 Response
```json
{
  "success": true,
  "game": {
    "code": "ABC123",
    "status": "playing",
    "currentRound": 1,
    "startedAt": "2025-06-12T10:00:00Z"
  }
}
```

## 2. POST /api/games/:gameCode/rounds/start

### Purpose
Start a new round after the previous one completes or initialize the first round.

### Implementation Steps

#### 2.1 Input Validation
```typescript
// Optional request body:
{
  roundType?: 'TABOO' | 'CHARADES' | 'ONE_WORD' // If not provided, use next in sequence
}
```

#### 2.2 Authorization Check
- Verify request comes from player in the game
- Return 403 if unauthorized

#### 2.3 Pre-conditions Validation
- Game is in `playing` state
- Previous round (if any) is completed
- Phrases are available to play (reset bowl if needed)

#### 2.4 Database Transaction
```typescript
// Within a single transaction:
1. If previous round exists:
   - Ensure rounds.status = 'COMPLETED' for previous round
   - Calculate and store round scores

2. Create new round:
   - round_number = previous + 1
   - round_type = next in sequence or from request
   - started_at = NOW()
   - status = 'ACTIVE'

3. Update games table:
   - current_round = new round number
   - current_round_type = round type

4. Reset phrase states for new round:
   - If all phrases were guessed, reset:
     UPDATE phrases SET guessed = false, status = 'in_bowl'
   - Track which phrases are available this round

5. Initialize first turn of round:
   - Determine starting team (rotate from last round)
   - Set acting player
```

#### 2.5 Socket Event Emission
```typescript
// In the REST endpoint, after successful database update:
import { broadcastRoundStarted } from '../sockets/SOCKET-API';

await broadcastRoundStarted(io, {
  gameCode,
  roundNumber: 2,
  roundType: 'CHARADES',
  startedAt: new Date(),
  actingTeam: teamId,
  actingPlayer: playerId,
  phrasesInBowl: 45,
  teamsOrder: [...] // Turn order for this round
});
```

#### 2.6 Socket Event Handler (Add to SOCKET-API.ts)
```typescript
// Add this interface to SOCKET-API.ts
export interface RoundStartedData {
  gameCode: string;
  roundNumber: number;
  roundType: 'TABOO' | 'CHARADES' | 'ONE_WORD';
  startedAt: Date;
  actingTeam: string;
  actingPlayer: string;
  phrasesInBowl: number;
  teamsOrder: string[];
}

// Add this broadcast function to SOCKET-API.ts
export async function broadcastRoundStarted(
  io: SocketIOServer,
  data: RoundStartedData
): Promise<void> {
  try {
    io.to(data.gameCode).emit('round:started', data);
    console.log(`Broadcasting round started for game ${data.gameCode}, round ${data.roundNumber}`);
  } catch (error) {
    console.error('Error broadcasting round started:', error);
  }
}
```

#### 2.7 Response
```json
{
  "success": true,
  "round": {
    "number": 2,
    "type": "CHARADES",
    "status": "ACTIVE",
    "startedAt": "2025-06-12T10:15:00Z",
    "actingTeam": "team-uuid-1",
    "actingPlayer": "player-uuid-3"
  }
}
```

## 3. GET /api/games/:gameCode/state

### Purpose
Retrieve comprehensive current game state for UI synchronization.

### Implementation Steps

#### 3.1 Input Validation
```typescript
// Path parameter: gameCode (string)
// Optional query params:
// ?includeScores=true
// ?includePlayerDetails=true
```

#### 3.2 Authorization Check
- Any player in the game can request state
- Optionally include deviceId for session validation

#### 3.3 Data Aggregation
```typescript
// Fetch from multiple tables:
1. Game basic info from games table
2. Current round details from rounds table
3. Current turn info from turns table
4. Team scores and standings
5. Player statuses
6. Phrases statistics (remaining, guessed per round)
7. Timer state if turn is active
```

#### 3.4 Socket Event Support (Add to SOCKET-API.ts)
```typescript
// Add handler for clients requesting game state
export async function handleRequestGameState(
  socket: Socket,
  data: { gameCode: string; includeScores?: boolean; includePlayerDetails?: boolean }
): Promise<void> {
  try {
    const playerConnection = connectedPlayers.get(socket.id);
    if (!playerConnection || playerConnection.gameCode !== data.gameCode) {
      socket.emit('error', { message: 'Not connected to this game' });
      return;
    }

    // Emit current game state (simplified version)
    // Full state should come from REST API
    await sendGameStateToPlayer(socket, data.gameCode, null);
  } catch (error) {
    console.error('Error in handleRequestGameState:', error);
    socket.emit('error', { message: 'Failed to get game state' });
  }
}

// Add periodic game state sync broadcast
export async function broadcastGameStateSync(
  io: SocketIOServer,
  gameCode: string,
  state: any
): Promise<void> {
  try {
    io.to(gameCode).emit('game:state-sync', {
      ...state,
      syncedAt: new Date()
    });
  } catch (error) {
    console.error('Error broadcasting game state sync:', error);
  }
}
```

#### 3.5 Response Structure
```json
{
  "game": {
    "code": "ABC123",
    "name": "Friday Night Game",
    "status": "playing",
    "hostId": "host-uuid",
    "config": {
      "turnDurationSeconds": 60,
      "phrasesPerPlayer": 3,
      "roundTypes": ["TABOO", "CHARADES", "ONE_WORD"],
      "skipPenalty": -1
    },
    "startedAt": "2025-06-12T10:00:00Z",
    "currentRound": 2,
    "totalRounds": 3
  },
  "round": {
    "number": 2,
    "type": "CHARADES",
    "status": "ACTIVE",
    "startedAt": "2025-06-12T10:15:00Z"
  },
  "currentTurn": {
    "turnId": "turn-uuid",
    "actingPlayer": {
      "id": "player-uuid",
      "name": "Alice",
      "teamId": "team-1"
    },
    "actingTeam": "team-1",
    "startedAt": "2025-06-12T10:16:00Z",
    "timeRemaining": 45,
    "phrasesGuessed": 3,
    "phrasesSkipped": 1,
    "isActive": true
  },
  "teams": [
    {
      "id": "team-1",
      "name": "Red Team",
      "players": ["player-1", "player-2"],
      "totalScore": 15,
      "roundScores": {
        "1": 8,
        "2": 7
      }
    },
    {
      "id": "team-2",
      "name": "Blue Team",
      "players": ["player-3", "player-4"],
      "totalScore": 13,
      "roundScores": {
        "1": 9,
        "2": 4
      }
    }
  ],
  "phrases": {
    "total": 24,
    "remaining": 11,
    "guessedThisRound": 13,
    "inBowl": 11
  },
  "nextUp": {
    "team": "team-2",
    "player": "player-3"
  }
}
```

## Socket Events Summary

### Events Emitted by Server:
- `game:started` - When game transitions to playing state
- `round:started` - When a new round begins
- `game:state-sync` - Periodic full game state updates

## Integration with REST Endpoints

Each REST endpoint should import and use the appropriate broadcast functions:

```typescript
// In game start endpoint
import { broadcastGameStarted } from '../sockets/SOCKET-API';

// After successful database updates
await broadcastGameStarted(io, {
  gameCode,
  status: 'playing',
  currentRound: 1,
  // ... other data
});

// In round start endpoint
import { broadcastRoundStarted } from '../sockets/SOCKET-API';

// After successful round creation
await broadcastRoundStarted(io, {
  gameCode,
  roundNumber: newRound.number,
  // ... other data
});
```

## Error Handling

### Common Error Scenarios:
1. **Insufficient Players**: "Game requires at least 2 teams and at least 2 players per team"
2. **Insufficient Phrases**: "Game requires at least (Congifured phrasesPerPlayer on Game) x (Number of Players) phrases"
3. **Invalid State Transition**: "Cannot start game in current state"
4. **Round Already Active**: "A round is already in progress"
5. **No Phrases Available**: "All phrases have been guessed"
6. **Socket Disconnected**: Handle gracefully without blocking REST operations

## Testing Checklist

- [ ] Start game with minimum requirements
- [ ] Prevent starting with insufficient players/phrases
- [ ] Verify player is in the game authorization
- [ ] Test round progression (TABOO → CHARADES → ONE_WORD)
- [ ] Verify phrase bowl reset between rounds
- [ ] Test socket events reach all connected clients
- [ ] Verify state endpoint returns accurate data
- [ ] Test concurrent requests don't cause race conditions
- [ ] Verify transaction rollback on errors
- [ ] Test socket reconnection maintains game state
- [ ] Verify broadcasts work when some players are disconnected

## Implementation Order

1. Add new interfaces and broadcast functions to SOCKET-API.ts
2. Implement GET /state endpoint (read-only, safer)
3. Implement POST /start with full validation and socket broadcasts
4. Implement POST /rounds/start with socket integration
5. Add comprehensive error handling
6. Write integration tests for REST + Socket.IO
7. Document WebSocket event payloads
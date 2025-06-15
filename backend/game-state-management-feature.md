# Game State Management API Implementation Plan (with Socket.IO Integration)

## Overview
Implement two core game state management endpoints to `backend/src/controllers/game.ts` with real-time Socket.IO updates to all connected device sessions.d

```typescript
// Start a new round
POST /api/games/:gameCode/rounds/start

// Get current game state
GET /api/games/:gameCode/state
```

## 1. POST /api/games/:gameCode/rounds/start

### Purpose
Start a new round after the previous one completes or initialize the first round.

### Implementation Steps

#### 1.1 Authorization Check
- Verify request comes from player in the game
- Return 403 if unauthorized

#### 1.2 Pre-conditions Validation
- Game is in `round_intro` state

#### 1.3 Database Transaction
```typescript
// Within a single transaction:
1. Create a new turn and pick the next playerin the sequence to start the turn

2. Update Game in database:
   - current_round = previous + 1
   - current_turn = turn just created
   - current_team = team of the player turn just created

3. Reset phrase states for new round:
   - Reset all phrases:
     UPDATE phrases SET status = `active`
```

#### 1.4 Socket Event Emission
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

#### 1.5 Socket Event Handler (Add to SOCKET-API.ts)
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

#### 1.6 Response
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

## 2. GET /api/games/:gameCode/state

### Purpose
Retrieve comprehensive current game state for UI synchronization.

### Implementation Steps

#### 2.1 Input Validation
```typescript
// Path parameter: gameCode (string)
// Optional query params:
// ?includeScores=true
// ?includePlayerDetails=true
```

#### 2.2 Authorization Check
- Any player in the game can request state
- Optionally include deviceId for session validation

#### 2.3 Data Aggregation
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

#### 2.4 Socket Event Support (Add to SOCKET-API.ts)
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

#### 2.5 Response Structure
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
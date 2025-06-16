# 🔁 Turn Endpoints

Turn endpoints provide functionality for managing turn progression in Fishbowl games.

[← Back to API Documentation](../README.md)

## Endpoints

### <span style="color: orange;">POST /api/games/:gameId/turns/end</span>
Ends the current turn and progresses to the next player in the circular turn order.

**Features:**
- Validates the requesting player is the current player
- Marks the current turn as complete
- Uses circular linked list to determine next player
- Creates new turn for the next player
- Updates game state with turn progression
- Maintains draft order across rounds

**Path Parameters:**
- `gameId` (string): The game code/ID

**Request Body:**
```typescript
{
  playerId: string;                    // Required: ID of player requesting to end turn
}
```

**Validation:**
- Game must exist and be in 'playing' status
- Requesting player must be the current player (security check)
- Current player must be connected
- Must have an active turn to end

**Response:**
```typescript
{
  success: boolean;                    // Always true on success
  message: string;                     // Success message
  game: {
    id: string;                        // Game code
    status: 'playing';                 // Game status
    sub_status: 'turn_starting';       // Brief moment between turns
    current_round: number;             // Current round number
    current_turn_id: string;           // ID of the new turn
  };
  previousTurn: {
    id: string;                        // ID of the completed turn
    player_id: string;                 // Player who just finished
    completed: true;                   // Turn completion status
  };
  nextTurn: {
    id: string;                        // ID of the new turn
    player_id: string;                 // Player whose turn it is now
    team_id: string;                   // Team of the current player
    round: number;                     // Current round number
  };
  nextPlayer: {
    id: string;                        // Player ID
    name: string;                      // Player name
    team_id: string;                   // Team assignment
  };
}
```

**Turn Order Management:**
- Uses **circular linked list** for seamless navigation
- Automatically skips disconnected players
- Maintains **draft pattern** established at game start
- Preserves turn order across all 3 rounds

**Error Responses:**

**400 Bad Request - Invalid Game ID:**
```json
{
  "error": "Invalid game ID"
}
```

**400 Bad Request - Missing Player ID:**
```json
{
  "error": "Player ID is required"
}
```

**400 Bad Request - Game Not Playing:**
```json
{
  "error": "Game is not in progress",
  "currentStatus": "setup"
}
```

**400 Bad Request - No Current Turn:**
```json
{
  "error": "No current turn found"
}
```

**403 Forbidden - Not Your Turn:**
```json
{
  "error": "Not your turn",
  "currentPlayer": "player-uuid-here"
}
```

**400 Bad Request - Player Disconnected:**
```json
{
  "error": "Current player is not connected"
}
```

**400 Bad Request - No Next Player:**
```json
{
  "error": "No next player available",
  "message": "All other players may be disconnected"
}
```

**404 Not Found - Game Not Found:**
```json
{
  "error": "Game not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to end turn",
  "message": "Specific error details"
}
```

## Turn Order System

### Circular Linked List Structure
The turn order system uses a circular linked list where:
- Every player points to the **next** player in the sequence
- Every player points to the **previous** player in the sequence
- The last player points back to the first player (circular)
- Navigation is seamless without special cases

### Draft Pattern
The turn order follows a snake draft pattern established at game start:

**Example with 3 teams (A, B, C) with 2 players each:**
```
Player Order: A1 → B1 → C1 → A2 → B2 → C2 → A1 → ...
```

## Usage Examples

### Ending a Turn
```javascript
// Player ends their turn
const response = await fetch('/api/games/ABC123/turns/end', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    playerId: 'player-uuid-12345'
  })
});

const result = await response.json();
console.log('Next player:', result.nextPlayer.name);
```

### Error Handling
```javascript
try {
  const response = await fetch('/api/games/ABC123/turns/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: 'wrong-player-id' })
  });
  
  if (!response.ok) {
    const error = await response.json();
    if (response.status === 403) {
      console.log('Not your turn! Current player:', error.currentPlayer);
    }
  }
} catch (error) {
  console.error('Failed to end turn:', error);
}
```

## Related Documentation

- [Game Endpoints](./game-endpoints.md) - Game creation and management
- [Player Endpoints](./player-endpoints.md) - Player management
- [Technical Documentation](../technical/turn-order-system.md) - Implementation details

[← Back to API Documentation](../README.md)
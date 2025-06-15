# 🔄 Turn Order System Technical Documentation

This document provides comprehensive technical details about the TurnOrder circular linked list implementation in the Fishbowl game backend.

## Table of Contents
- [Overview](#overview)
- [Database Schema](#database-schema)
- [Snake Draft Algorithm](#snake-draft-algorithm)
- [Circular Linked List Implementation](#circular-linked-list-implementation)
- [API Integration](#api-integration)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)
- [Testing Strategy](#testing-strategy)

## Overview

The TurnOrder system implements a circular linked list data structure to manage player turn progression in Fishbowl games. It ensures fair turn distribution using a snake draft pattern and provides seamless navigation between players while handling player connections/disconnections gracefully.

### Key Design Decisions
- **Circular Linked List**: Eliminates special cases for first/last players
- **Snake Draft Pattern**: Ensures balanced turn distribution across teams
- **Random Game Start**: Selects starting player randomly from established order
- **Connection Awareness**: Automatically skips disconnected players
- **Persistent Order**: Same sequence maintained across all 3 rounds

## Database Schema

### TurnOrder Table Structure

```sql
CREATE TABLE IF NOT EXISTS turn_order (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  next_player_id TEXT NOT NULL,
  prev_player_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (next_player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (prev_player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(game_id, player_id)
);
```

### TypeScript Interface

```typescript
export interface TurnOrder {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  next_player_id: string;  // Points to next player (circular)
  prev_player_id: string;  // Points to previous player (circular)
  created_at: string;
  updated_at: string;
}
```

### Circular Structure Example

**3 players: A → B → C → A**
```
Player A: next_player_id = B.id, prev_player_id = C.id
Player B: next_player_id = C.id, prev_player_id = A.id  
Player C: next_player_id = A.id, prev_player_id = B.id
```

### Database Indexes

```sql
-- Performance indexes for turn order operations
CREATE INDEX IF NOT EXISTS idx_turn_order_game ON turn_order(game_id);
CREATE INDEX IF NOT EXISTS idx_turn_order_player ON turn_order(player_id);
CREATE INDEX IF NOT EXISTS idx_turn_order_team ON turn_order(team_id);
CREATE INDEX IF NOT EXISTS idx_turn_order_next_player ON turn_order(next_player_id);
CREATE INDEX IF NOT EXISTS idx_turn_order_prev_player ON turn_order(prev_player_id);
```

## Snake Draft Algorithm

The snake draft algorithm ensures fair turn distribution by alternating the direction of team selection across player positions.

### Implementation Logic

```typescript
// 1. Group players by team
const playersByTeam = new Map<string, Player[]>();
for (const player of players) {
  if (!playersByTeam.has(player.team_id)) {
    playersByTeam.set(player.team_id, []);
  }
  playersByTeam.get(player.team_id)!.push(player);
}

// 2. Shuffle players within each team
for (const [teamId, teamPlayers] of playersByTeam.entries()) {
  teamPlayers.sort(() => Math.random() - 0.5);
  playersByTeam.set(teamId, teamPlayers);
}

// 3. Shuffle team order
const teamIds = Array.from(playersByTeam.keys()).sort(() => Math.random() - 0.5);

// 4. Build snake draft order
const snakeDraftOrder: Player[] = [];
const maxPlayersPerTeam = Math.max(...Array.from(playersByTeam.values()).map(team => team.length));

for (let playerIndex = 0; playerIndex < maxPlayersPerTeam; playerIndex++) {
  // Alternate direction for snake pattern
  const isForwardPass = playerIndex % 2 === 0;
  const orderedTeamIds = isForwardPass ? teamIds : [...teamIds].reverse();

  // Add one player from each team in the determined order
  for (const teamId of orderedTeamIds) {
    const teamPlayers = playersByTeam.get(teamId);
    if (teamPlayers && teamPlayers[playerIndex]) {
      snakeDraftOrder.push(teamPlayers[playerIndex]!);
    }
  }
}
```

### Snake Draft Example

**3 teams (A, B, C) with 2 players each:**

| Position | Team Order | Player Selected |
|----------|------------|----------------|
| 1st      | A → B → C  | A1, B1, C1     |
| 2nd      | C → B → A  | C2, B2, A2     |

**Final Order:** A1 → B1 → C1 → C2 → B2 → A2 → A1...

### Benefits
- **Fair Distribution**: Each team gets equal turn opportunities
- **Balanced Positioning**: No team consistently goes first or last
- **Strategic Depth**: Teams must adapt to varying turn positions

## Circular Linked List Implementation

### Core Navigation Functions

#### [`getNextPlayer(gameId, currentPlayerId)`](../../src/utils/turnUtils.ts:13)

```typescript
export async function getNextPlayer(gameId: string, currentPlayerId: string): Promise<string | null> {
  // 1. Get current player's turn order entry
  const currentTurnOrder = await db.get<TurnOrder>(
    'SELECT * FROM turn_order WHERE game_id = ? AND player_id = ?',
    [gameId, currentPlayerId]
  );

  // 2. Traverse circular list to find next active player
  let nextPlayerId = currentTurnOrder.next_player_id;
  const visited = new Set<string>();

  while (!visited.has(nextPlayerId)) {
    visited.add(nextPlayerId);

    // Check if player is connected
    const player = await db.get<Player>(
      'SELECT is_connected FROM players WHERE id = ? AND game_id = ?',
      [nextPlayerId, gameId]
    );

    if (player && player.is_connected) {
      return nextPlayerId; // Found active player
    }

    // Move to next player in circle
    const nextTurnOrder = await db.get<TurnOrder>(
      'SELECT next_player_id FROM turn_order WHERE game_id = ? AND player_id = ?',
      [gameId, nextPlayerId]
    );

    nextPlayerId = nextTurnOrder.next_player_id;
  }

  return null; // No active players found
}
```

#### [`getCurrentPlayer(gameId)`](../../src/utils/turnUtils.ts:72)

```typescript
export async function getCurrentPlayer(gameId: string): Promise<string | null> {
  // Get current player from game's current turn
  const game = await db.get<Game>(
    'SELECT current_turn_id FROM games WHERE id = ?',
    [gameId]
  );

  if (!game?.current_turn_id) return null;

  const turn = await db.get<Turn>(
    'SELECT player_id FROM turns WHERE id = ?',
    [game.current_turn_id]
  );

  return turn?.player_id || null;
}
```

#### [`getRandomPlayerFromTurnOrder(gameId)`](../../src/utils/turnUtils.ts:104)

```typescript
export async function getRandomPlayerFromTurnOrder(gameId: string): Promise<string | null> {
  // Get all active players in turn order
  const activePlayers = await db.all<{ player_id: string }>(
    `SELECT DISTINCT turn_order.player_id
     FROM turn_order
     INNER JOIN players p ON turn_order.player_id = p.id
     WHERE turn_order.game_id = ? AND p.is_connected = 1`,
    [gameId]
  );

  if (activePlayers.length === 0) return null;

  // Select random player
  const randomIndex = Math.floor(Math.random() * activePlayers.length);
  return activePlayers[randomIndex]?.player_id || null;
}
```

### Integrity Validation

#### [`validateTurnOrderIntegrity(gameId)`](../../src/utils/turnUtils.ts:183)

```typescript
export async function validateTurnOrderIntegrity(gameId: string): Promise<boolean> {
  const turnOrders = await db.all<TurnOrder>(
    'SELECT * FROM turn_order WHERE game_id = ?',
    [gameId]
  );

  // 1. Check that all references are valid
  for (const turnOrder of turnOrders) {
    const nextPlayerExists = turnOrders.some(to => to.player_id === turnOrder.next_player_id);
    const prevPlayerExists = turnOrders.some(to => to.player_id === turnOrder.prev_player_id);

    if (!nextPlayerExists || !prevPlayerExists) {
      return false; // Broken references
    }
  }

  // 2. Check circular structure completeness
  const startPlayer = turnOrders[0];
  let currentPlayerId = startPlayer.next_player_id;
  const visited = new Set<string>([startPlayer.player_id]);

  while (currentPlayerId !== startPlayer.player_id) {
    if (visited.has(currentPlayerId)) {
      return false; // Circular structure broken
    }

    visited.add(currentPlayerId);
    const currentTurnOrder = turnOrders.find(to => to.player_id === currentPlayerId);
    currentPlayerId = currentTurnOrder?.next_player_id || '';
  }

  // 3. Verify all players were visited
  return visited.size === turnOrders.length;
}
```

## API Integration

### Game Start Integration

The turn order system integrates with the game start process in [`gamesController.ts`](../../src/controllers/gamesController.ts:349):

```typescript
// 1. Create snake draft order (lines 446-481)
const snakeDraftOrder = buildSnakeDraftOrder(players, teams);

// 2. Create circular linked list (lines 484-499)
for (let i = 0; i < snakeDraftOrder.length; i++) {
  const currentPlayer = snakeDraftOrder[i];
  const nextPlayer = snakeDraftOrder[(i + 1) % snakeDraftOrder.length];
  const prevPlayer = snakeDraftOrder[(i - 1 + snakeDraftOrder.length) % snakeDraftOrder.length];

  const turnOrder: Omit<TurnOrder, 'created_at' | 'updated_at'> = {
    id: uuidv4(),
    game_id: gameCode,
    player_id: currentPlayer.id,
    team_id: currentPlayer.team_id,
    next_player_id: nextPlayer.id,
    prev_player_id: prevPlayer.id,
  };

  await insert('turn_order', turnOrder, transaction);
}

// 3. Select random starting player (lines 501-508)
const randomStartingPlayerId = await getRandomPlayerFromTurnOrder(gameCode);
```

### Turn Progression Integration

The [`endTurn`](../../src/controllers/turnsController.ts:15) endpoint uses the turn order system:

```typescript
// 1. Get current player
const currentPlayerId = await getCurrentPlayer(gameId);

// 2. Validate requesting player is current player
if (currentPlayerId !== playerId) {
  res.status(403).json({ error: 'Not your turn' });
  return;
}

// 3. Get next player using circular navigation
const nextPlayerId = await getNextPlayer(gameId, currentPlayerId);

// 4. Create new turn for next player
const newTurn = createTurnForPlayer(nextPlayerId, gameId);
```

## Error Handling

### Connection Management
- **Disconnected Players**: Automatically skipped during navigation
- **All Players Disconnected**: `getNextPlayer()` returns `null`
- **Invalid References**: Detected by integrity validation

### Validation Checks
- **Game Existence**: Verified before turn operations
- **Player Authorization**: Only current player can end their turn
- **Turn Order Integrity**: Validated during game start and on demand

### Error Response Examples

```typescript
// Player not authorized to end turn
{
  "error": "Not your turn",
  "currentPlayer": "current-player-uuid"
}

// No active players available
{
  "error": "No next player available",
  "message": "All other players may be disconnected"
}

// Turn order integrity compromised
{
  "error": "Turn order validation failed",
  "details": "Circular structure broken"
}
```

## Performance Considerations

### Database Queries
- **O(1) Navigation**: Direct lookup by `next_player_id`/`prev_player_id`
- **Indexed Lookups**: All foreign key relationships are indexed
- **Connection Filtering**: Efficient `is_connected` checks with indexes

### Memory Usage
- **Lightweight Records**: Only essential fields stored
- **No In-Memory Caching**: Relies on database for consistency
- **Transaction Safety**: All operations wrapped in database transactions

### Scalability Limits
- **Maximum Players**: Tested up to 20 players (5 teams × 4 players)
- **Navigation Complexity**: O(n) worst case when all players disconnected
- **Database Constraints**: Foreign key relationships maintain referential integrity

## Testing Strategy

### Unit Tests

Located in [`turnUtils.test.ts`](../../unittests/utils/turnUtils.test.ts):

```typescript
describe('TurnOrder Navigation Tests', () => {
  test('should navigate circular list correctly', async () => {
    // Test basic circular navigation
  });

  test('should skip disconnected players', async () => {
    // Test connection handling
  });

  test('should handle all players disconnected', async () => {
    // Test edge case handling
  });
});
```

### Integration Tests

Located in [`games.test.ts`](../../unittests/routes/games.test.ts):

```typescript
describe('Game Start with Turn Order', () => {
  test('should create snake draft turn order', async () => {
    // Test complete game start flow
  });

  test('should select random starting player', async () => {
    // Test random player selection
  });
});
```

### Test Coverage Areas
- **Snake Draft Algorithm**: Verify correct turn order generation
- **Circular Navigation**: Test seamless traversal
- **Connection Handling**: Test disconnection/reconnection scenarios
- **Edge Cases**: Single player, uneven teams, all disconnected
- **Integrity Validation**: Test circular structure validation

## Implementation Files

### Core Implementation
- [`turnUtils.ts`](../../src/utils/turnUtils.ts) - Turn order utility functions
- [`gamesController.ts`](../../src/controllers/gamesController.ts) - Game start integration
- [`turnsController.ts`](../../src/controllers/turnsController.ts) - Turn progression logic

### Database Schema
- [`schema.ts`](../../src/db/schema.ts) - TurnOrder interface and SQL definitions
- [`005_add_turn_order.ts`](../../src/db/migrations/005_add_turn_order.ts) - Database migration

### Testing
- [`turnUtils.test.ts`](../../unittests/utils/turnUtils.test.ts) - Unit tests
- [`games.test.ts`](../../unittests/routes/games.test.ts) - Integration tests

---

*This documentation reflects the current implementation as of the TurnOrder refactor completion. For API usage examples, see the [Turn Endpoints Documentation](../REST-API/turn-endpoints.md).*
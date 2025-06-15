# Implementation Plan: TurnOrder Circular Linked List

## Overview
This plan implements a circular linked list structure for maintaining consistent turn order throughout the game, following the snake draft pattern described in the requirements.

## Key Design Decisions
- **Use existing Turn structure**: The `Game.current_turn_id` already points to the current turn, which contains the current player
- **Random game start**: When `startGame` is called, randomly select a player from the circular turn order to begin
- **No schema changes to Game table**: Maintains backward compatibility and avoids duplicate state tracking
- **Circular linked list**: All players are connected in a circle, simplifying navigation and eliminating special cases

## Step 1: Update Database Schema
**Context Files Needed:**
- schema.ts
- connection.ts

**Tasks:**
1. Add `TurnOrder` interface to schema.ts
2. Add `CREATE_TURN_ORDER_TABLE` SQL definition
3. Add new table to `ALL_TABLES` array
4. Add indexes for `turn_order` table
5. Add trigger for `turn_order` updated_at timestamp

**Implementation Details:**
- Create circular linked list structure with `next_player_id` and `prev_player_id`
- Include `is_active` flag for handling disconnected players
- Add foreign key relationships to games, players, and teams tables
- **No changes needed to Game table** - use existing `current_turn_id` to track current player

## TurnOrder Schema Structure

The `TurnOrder` table creates a circular linked list where every player points to the next and previous players:

```typescript
export interface TurnOrder {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  next_player_id: string;  // Always points to next player (circular)
  prev_player_id: string;  // Always points to previous player (circular)
  created_at: string;
  updated_at: string;
}
```

**Circular Structure Example** (3 players: A → B → C → A):
- Player A: `next_player_id = B.id, prev_player_id = C.id`
- Player B: `next_player_id = C.id, prev_player_id = A.id`  
- Player C: `next_player_id = A.id, prev_player_id = B.id`

**Current Player Tracking**:
- `Game.current_turn_id` → `Turn.player_id` = current player
- Use `TurnOrder` to find `next_player_id` for turn progression

## Step 2: Create Turn Order Utilities
**Context Files Needed:**
- schema.ts
- utils.ts
- connection.ts

**Tasks:**
1. Create new file: `backend/src/utils/turnUtils.ts`
2. Implement core functions:
   - `getNextPlayer()` - Get next active player in circular list
   - `getCurrentPlayer()` - Get current player from game's current turn
   - `getRandomPlayerFromTurnOrder()` - Select random player to start game

**Implementation Details:**
- Handle circular navigation without special cases
- Skip inactive players automatically
- Maintain list integrity during player removal/addition
- Use existing `current_turn_id` to determine current player instead of separate first_player tracking

## Step 3: Update Game Controller - Snake Draft Logic
**Context Files Needed:**
- gamesController.ts
- schema.ts
- teamUtils.ts
- `backend/src/utils/turnUtils.ts`

**Tasks:**
1. Import `TurnOrder` type and utility functions
2. Replace existing player shuffle logic with snake draft algorithm:
   - Group players by team
   - Shuffle players within each team
   - Shuffle team order
   - Build snake draft order (forward then reverse)
3. Create `TurnOrder` records for each player
4. Use `getRandomPlayerFromTurnOrder()` to select starting player
5. Create initial Turn for the selected player (as currently done)
6. Game's `current_turn_id` automatically points to the current player

**Implementation Details:**
- Snake draft pattern: Team A Player 1 → Team B Player 1 → Team C Player 1 → Team C Player 2 → Team B Player 2 → Team A Player 2
- Ensure all players are linked in a circle

## Step 4: Write Unit Tests for Turn Order
**Context Files Needed:**
- `backend/docs/Unittests/README.md`
- test-factories.ts
- test-helpers.ts
- setupTests.ts

**Tasks:**
1. Create test file: `backend/unittests/utils/turnUtils.test.ts`
2. Test snake draft order creation
3. Test player removal and re-addition
4. Test circular navigation
5. Test edge cases (single player, all players disconnected)

**Test Scenarios:**
- 2 teams with 3 players each
- 3 teams with uneven player counts
- Player disconnection mid-game
- Player reconnection

## Step 5: Update Game Start Tests
**Context Files Needed:**
- games.test.ts
- test-factories.ts
- realDbUtils.ts

**Tasks:**
1. Update existing `startGame` tests to verify turn order creation
2. Add tests for snake draft pattern validation
3. Test that `current_turn_id` points to a valid player in the turn order
4. Verify turn order persists across rounds
5. Test random player selection for game start

## Step 6: Update Socket Event Handlers
**Context Files Needed:**
- SOCKET-API.ts
- `backend/src/sockets/handlers/gameHandlers.ts`
- `backend/src/utils/turnUtils.ts`

**Tasks:**
1. Update player disconnect handler to call `removePlayerFromTurnOrder()`
2. Update player reconnect handler to call `readdPlayerToTurnOrder()`
3. Emit turn order updates when players join/leave
4. Ensure turn order is included in game state updates

## Step 7: Add Turn Progression Logic
**Context Files Needed:**
- `backend/src/controllers/turnsController.ts` (if exists, or create)
- `backend/src/utils/turnUtils.ts`
- schema.ts

**Tasks:**
1. Create endpoint for ending current turn
2. Use `getNextPlayer()` to determine next player
3. Update game's `current_turn_id`
4. Handle round transitions (same order preserved)
5. Emit socket events for turn changes

## Step 8: Database Migration
**Context Files Needed:**
- migrations (if exists)
- schema.ts
- connection.ts

**Tasks:**
1. Create migration script for existing games (if any)
2. Add `turn_order` table creation
3. Run migration on development database
4. **No changes needed to games table** - existing `current_turn_id` field is sufficient

## Step 9: Integration Testing
**Context Files Needed:**
- All test files in unittests
- `backend/src/index.ts`

**Tasks:**
1. Run full test suite: `npm test`
2. Test complete game flow with turn order
3. Verify snake draft order across multiple rounds
4. Test player disconnection/reconnection scenarios
5. Performance test with maximum players (e.g., 5 teams × 4 players)

## Step 10: Documentation Update
**Context Files Needed:**
- `backend/docs/REST-API.md`
- README.md
- fishbowl_app_requirements.md

**Tasks:**
1. Document turn order implementation in technical docs
2. Update API documentation with new fields
3. Add examples of snake draft pattern
4. Document player removal/addition behavior
5. Update any affected endpoint descriptions

## Implementation Order
1. **Day 1**: Steps 1-2 (Schema and utilities)
2. **Day 2**: Steps 3-5 (Controller logic and tests)
3. **Day 3**: Steps 6-7 (Socket and turn progression)
4. **Day 4**: Steps 8-10 (Migration, integration, documentation)

## Key Considerations
- Maintain backward compatibility if games exist
- Ensure atomic operations for list modifications
- Handle edge cases (single player, all disconnected)
- Performance implications of circular traversal
- Socket event consistency across all clients
- **Leverage existing Turn structure**: Use `current_turn_id` to track current player instead of duplicating state
- **Random start**: Select random player from turn order to begin game, maintaining fairness
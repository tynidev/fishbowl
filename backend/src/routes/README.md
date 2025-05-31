# Game Routes Implementation

This document describes the implementation of the Fishbowl game API routes.

## Overview

The game routes provide RESTful endpoints for managing games, players, and game configuration in the Fishbowl application.

## API Endpoints

### POST /api/games
Creates a new game with a host player.

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

### POST /api/games/:gameCode/join
Allows a player to join an existing game.

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

### GET /api/games/:gameCode
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

### GET /api/games/:gameCode/players
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

### PUT /api/games/:gameCode/config
Updates game configuration (only available before game starts).

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

## Phrase Management Endpoints

### POST /api/games/:gameCode/phrases
Submit phrases for a player (supports single phrase or array).

**Request Body:**
```typescript
{
  phrases: string | string[];        // Single phrase or array of phrases
  playerId: string;                  // Required: Player UUID
}
```

**Response:**
```typescript
{
  submittedCount: number;            // Number of phrases submitted
  totalRequired: number;             // Total phrases required for player
  phrases: Array<{
    id: string;                      // Phrase UUID
    text: string;                    // Phrase text
    submittedAt: string;             // Submission timestamp
  }>;
}
```

**Validation:**
- Game must be in 'waiting' or 'phrase_submission' status
- Player must exist in the game
- Cannot exceed phrases per player limit
- No duplicate phrases within the game (case-insensitive)
- Phrase text: 1-100 characters, valid characters only

### GET /api/games/:gameCode/phrases
Retrieves all phrases for the game (host authorization required).

**Query Parameters:**
- `playerId` - Required for authorization (must be game host)

**Response:**
```typescript
{
  phrases: Array<{
    id: string;                      // Phrase UUID
    text: string;                    // Phrase text
    playerId: string;                // Submitting player UUID
    playerName: string;              // Submitting player name
    submittedAt: string;             // Submission timestamp
  }>;
  totalCount: number;                // Total phrase count
  gameInfo: {
    phrasesPerPlayer: number;        // Phrases per player setting
    totalPlayers: number;            // Number of players
    totalExpected: number;           // Expected total phrases
  };
}
```

### GET /api/games/:gameCode/phrases/status
Gets phrase submission status for all players (publicly accessible).

**Response:**
```typescript
{
  players: Array<{
    playerId: string;                // Player UUID
    playerName: string;              // Player name
    submitted: number;               // Phrases submitted
    required: number;                // Phrases required
    isComplete: boolean;             // Whether player is done
  }>;
  summary: {
    totalPlayers: number;            // Total players
    playersComplete: number;         // Players who finished
    totalPhrasesSubmitted: number;   // Total phrases submitted
    totalPhrasesRequired: number;    // Total phrases needed
    isAllComplete: boolean;          // Whether all players are done
  };
}
```

### PUT /api/games/:gameCode/phrases/:phraseId
Edit a specific phrase (only by submitting player, only before game starts).

**Query Parameters:**
- `playerId` - Required for authorization

**Request Body:**
```typescript
{
  text: string;                      // Updated phrase text
}
```

**Response:**
```typescript
{
  id: string;                        // Phrase UUID
  text: string;                      // Updated phrase text
  updatedAt: string;                 // Update timestamp
}
```

**Authorization:** Player can only edit their own phrases

### DELETE /api/games/:gameCode/phrases/:phraseId
Delete a specific phrase (only before game starts).

**Query Parameters:**
- `playerId` - Required for authorization

**Response:**
```typescript
{
  message: string;                   // Success message
}
```

**Authorization:**
- Player can delete their own phrases
- Game host can delete any phrase

## Features

### Game Code Generation
- Generates unique 6-character alphanumeric codes
- Validates uniqueness before assigning
- Maximum 10 attempts to generate unique code

### Player Management
- Validates player names (1-20 characters, alphanumeric + basic punctuation)
- Supports player reconnection with existing names
- Automatically assigns players to teams using round-robin

### Team Assignment
- Creates default teams with colors and names
- Automatically balances players across teams
- Supports team reconfiguration when team count changes

### Validation
- Comprehensive input validation
- Database transaction support
- Error handling with appropriate HTTP status codes

### Database Integration
- Uses database utilities for CRUD operations
- Transaction support for data consistency
- Proper error handling and cleanup

## Error Responses

All endpoints return appropriate HTTP status codes:
- `400` - Bad Request (invalid input)
- `404` - Not Found (game/resource not found)
- `500` - Internal Server Error

Error response format:
```typescript
{
  error: string;                   // Error message
  message?: string;                // Additional details
  details?: string[];              // Validation errors (if applicable)
}
```

## Implementation Notes

### Database Schema
The implementation assumes the following database tables:
- `games` - Game information
- `players` - Player information
- `teams` - Team information

### Transaction Usage
All write operations use database transactions to ensure data consistency.

### Type Safety
Full TypeScript support with proper type definitions for all request/response objects.

### Testing
Comprehensive unit tests covering:
- Successful operations
- Input validation
- Error conditions
- Database error handling

## Game Status Flow

1. **waiting** - Initial state, players can join, config can be updated
2. **phrase_submission** - Players are submitting phrases (transitions automatically on first phrase submission)
3. **playing** - Game has started, no more phrase changes allowed
4. **finished** - Game completed

## Validation Rules

### Phrases
- Length: 1-100 characters
- Allowed characters: letters, numbers, spaces, and basic punctuation (.,!?()'-_)
- No duplicates within the same game (case-insensitive)
- Players cannot exceed the configured phrases per player limit

### Game States
- Phrase submission only allowed in 'waiting' or 'phrase_submission' status
- Phrase editing/deletion only allowed in 'waiting' or 'phrase_submission' status
- Game configuration changes only allowed in 'waiting' status

## Next Steps

This implementation provides the foundation for:
1. ~~Phrase submission endpoints~~ ✅ **Completed**
2. Game play endpoints (start game, next turn, etc.)
3. Real-time updates via WebSocket
4. Score tracking
5. Game completion handling
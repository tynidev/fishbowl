# 📝 Phrase Endpoints

Phrase endpoints manage phrase submission, editing, and tracking for Fishbowl games.

[← Back to API Documentation](./README.md)

## Endpoints

### <span style="color: orange;">POST /api/games/:gameCode/phrases</span>
Submit phrases for a player (supports single phrase or array).

**Validation Rules:**
- Length: 1-100 characters
- Allowed characters: letters, numbers, spaces, and basic punctuation (.,!?()'-_)
- No duplicates within the same game (case-insensitive)
- Players cannot exceed the configured phrases per player limit
- Phrase submission only allowed in 'setup' status

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

### <span style="color: orange;">GET /api/games/:gameCode/phrases</span>
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

### <span style="color: orange;">GET /api/games/:gameCode/phrases/status</span>
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

### <span style="color: orange;">PUT /api/games/:gameCode/phrases/:phraseId</span>
Edit a specific phrase (only by submitting player, only before game starts).

**Features:**
- Phrase editing only allowed in 'setup' status
- Player can only edit their own phrases

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

### <span style="color: orange;">DELETE /api/games/:gameCode/phrases/:phraseId</span>
Delete a specific phrase (only before game starts).

**Features:**
- Phrase deletion only allowed in 'setup' status
- Player can delete their own phrases
- Game host can delete any phrase

**Query Parameters:**
- `playerId` - Required for authorization

**Response:**
```typescript
{
  message: string;                   // Success message
}
```

## Phrase Management Features

### Validation System
- **Content Validation**: Strict character and length requirements
- **Duplicate Prevention**: Case-insensitive duplicate detection within games
- **Rate Limiting**: Players cannot exceed their configured phrase limit

### Editing Capabilities
- **Player Editing**: Players can edit their own phrases before game starts
- **Host Management**: Game hosts can delete any phrase for content moderation
- **Status Restrictions**: Editing only allowed during setup phase

### Progress Tracking
- **Individual Progress**: Track submission status per player
- **Game Overview**: Monitor overall game readiness
- **Real-time Updates**: Live status updates for all participants

## Related Documentation

- [Game Endpoints](./game-endpoints.md) - Game configuration affecting phrase limits
- [Player Endpoints](./player-endpoints.md) - Player registration for phrase submission
- [Device Sessions](./device-session-endpoints.md) - Session management for phrase tracking

[← Back to API Documentation](./README.md)

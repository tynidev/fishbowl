# Fishbowl REST API Documentation

Welcome to the Fishbowl REST API documentation. This API provides comprehensive endpoints for managing games, players, phrases, and device sessions in the Fishbowl application.

## Quick Start

The Fishbowl API is a RESTful service that enables real-time multiplayer game management with WebSocket support for live updates.

## API Sections

### 🎮 [Game Management](./REST-API/game-endpoints.md)
- Create and configure games
- Manage game settings and status
- Game lifecycle management

### 👥 [Player Management](./REST-API/player-endpoints.md) 
- Player registration and authentication
- Team assignments and balancing
- Player status tracking

### 📝 [Phrase Management](./REST-API/phrase-endpoints.md)
- Phrase submission and validation
- Phrase editing and deletion
- Submission status tracking

### 📱 [Device Sessions](./REST-API/device-session-endpoints.md)
- Device ID generation and tracking
- Session management across games
- Connection status monitoring

### 🔄 [Turn Management](./REST-API/turn-endpoints.md)
- Turn progression and navigation
- Snake draft order implementation
- Circular linked list turn sequence
- Player connection handling

## Common Information

### Error Responses

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

### Game Status Flow

The game progresses through these states:

1. **waiting** - Initial state, players can join, config can be updated
2. **phrase_submission** - Players are submitting phrases (transitions automatically on first phrase submission)
3. **playing** - Game has started, no more phrase changes allowed
4. **finished** - Game completed

### Authentication

Most endpoints require either:
- **Player ID** - For player-specific actions
- **Host Authorization** - For administrative game actions
- **Device ID** - For session management

## Implementation Notes

### Database Schema
The implementation uses the following core tables:
- `games` - Game information and configuration
- `players` - Player information and team assignments
- `teams` - Team information and player groupings
- `phrases` - Player-submitted phrases for the game
- `turns` - Individual turn records and scoring
- `turn_order` - Circular linked list for turn progression
- `turn_phrases` - Phrase actions during specific turns
- `device_sessions` - Session management and device tracking

### Database Features
- Database transactions for data consistency
- Comprehensive validation and error handling
- Support for schema migrations and versioning
- Optimized queries for real-time performance

### Validation
- Input validation on all endpoints
- Business rule enforcement
- Proper HTTP status codes and error messages

## Getting Started

1. **Create a Game**: Use the [game creation endpoint](./docs/game-endpoints.md#post-apigames) to start a new game
2. **Join Players**: Players join using the [player join endpoint](./docs/player-endpoints.md#post-apigamesgamecodejoin)
3. **Submit Phrases**: Players submit phrases using [phrase endpoints](./docs/phrase-endpoints.md#post-apigamesgamecodephrases)
4. **Manage Sessions**: Track player connections with [device session endpoints](./docs/device-session-endpoints.md)

## API Base URL

```
http://localhost:3001/api
```

## Technical Documentation

### 🔄 [Turn Order System](./technical/turn-order-system.md)
- Circular linked list implementation details
- Snake draft algorithm explanation
- Database schema and performance considerations
- Testing strategies and implementation files

## Related Resources

- [Game Endpoints](./REST-API/game-endpoints.md) - Start here for game creation
- [Turn Endpoints](./REST-API/turn-endpoints.md) - Turn progression and management
- [Technical Documentation](./technical/turn-order-system.md) - Implementation details

For detailed endpoint documentation, navigate to the specific section links above.

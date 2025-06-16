# Fishbowl REST API Documentation

Welcome to the Fishbowl REST API documentation. This API provides comprehensive endpoints for managing games, players, phrases, and device sessions in the Fishbowl application.

## Quick Start

The Fishbowl API is a RESTful service that enables real-time multiplayer game management with WebSocket support for live updates.

## API Base URL

```
http://localhost:3001/api
```

## API Sections

### 🎮 [Game Management](./game-endpoints.md)
- Create and configure games
- Manage game settings and status
- Game lifecycle management

### 👥 [Player Management](./player-endpoints.md) 
- Player registration and authentication
- Team assignments and balancing
- Player status tracking

### 📝 [Phrase Management](./phrase-endpoints.md)
- Phrase submission and validation
- Phrase editing and deletion
- Submission status tracking

### 📱 [Device Sessions](./device-session-endpoints.md)
- Device ID generation and tracking
- Session management across games
- Connection status monitoring

### 🔄 [Turn Management](./turn-endpoints.md)
- Turn progression and navigation
- Circular draft order implementation
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

The game progresses through these states with detailed sub-statuses:

#### Setup Phase (`status: 'setup'`)
1. **waiting_for_players** - Players joining, getting assigned to teams, submitting phrases
2. **ready_to_start** - All players joined, all phrases submitted, host can start

#### Playing Phase (`status: 'playing'`)
3. **round_intro** - Showing round rules before starting
4. **turn_starting** - Brief moment between turns (showing whose turn)
5. **turn_active** - Active turn with timer running
6. **turn_paused** - Turn paused (disconnection, dispute, etc.)
7. **round_complete** - Round finished, showing scores before next round

#### Finished Phase (`status: 'finished'`)
8. **game_complete** - Final scores, game over
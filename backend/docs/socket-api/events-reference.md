# Socket API Events Reference

This document provides a comprehensive reference of all Socket.IO events used in the Fishbowl game.

## Event Naming Conventions

All events follow the standardized `colon:separated` pattern:
- `entity:action` - For simple events (e.g., `game:join`)
- `entity:state` - For state-related events (e.g., `game:state`)

## Client-to-Server Events

Events that clients emit to the server:

### Game Room Events

| Event | Description | Payload |
|-------|-------------|---------|
| `game:join` | Join a game room | `{ gameCode, playerId, playerName, deviceId }` |
| `game:leave` | Leave a game room | `{ gameCode, playerId }` |

## Server-to-Client Events

Events that the server emits to clients:

### Game Events

| Event | Description | Payload |
|-------|-------------|---------|
| `game:joined` | Confirmation of joining a game room | `{ gameCode, playerId, playerName, connectedAt }` |
| `game:state` | Complete game state | `{ game, players, teams, gameCode, updatedAt }` |
| `game:started` | Game has started | `{ gameCode, startedAt }` |

### Player Events

| Event | Description | Payload |
|-------|-------------|---------|
| `player:connected` | When a player connected to game room | `{ playerId, playerName, connectedAt }` |
| `player:disconnected` | When a player disconnected from game room | `{ playerId, playerName, disconnectedAt, reason? }` |

### Connection Events

| Event | Description | Payload |
|-------|-------------|---------|
| `connection:replaced` | Notifies an existing socket that it's being disconnected because the same player connected from a different socket | `{ message }` |

### Error Events

| Event | Description | Payload |
|-------|-------------|---------|
| `error` | Error occurred | `{ message, details? }` |

## Best Practices

1. **Error Handling**: Always listen for the `error` event to handle error cases
2. **State Synchronization**: Use `game:state` to get full state after joining

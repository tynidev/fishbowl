# Socket API Events Reference

This document provides a comprehensive reference of all Socket.IO events used in the Fishbowl game.

## Event Naming Conventions

All events follow the standardized `colon:separated` pattern:
- `entity:action` - For simple events (e.g., `game:join`)
- `entity:state` - For state-related events (e.g., `game:state`)

## Client-to-Server Events

Events that clients emit to the server:

### Game Events

| Event | Description | Payload |
|-------|-------------|---------|
| `game:join` | Join a game room | `{ gameCode, playerId, playerName, deviceId }` |
| `game:leave` | Leave a game room | `{ gameCode, playerId }` |

## Server-to-Client Events

Events that the server emits to clients:

### Game Events

| Event | Description | Payload |
|-------|-------------|---------|
| `game:joined` | Confirmation of joining a game | `{ gameCode, playerId, playerName, connectedAt }` |
| `game:state` | Complete game state | `{ game, players, teams, gameCode, updatedAt }` |
| `game:started` | Game has started | `{ gameCode, startedAt }` |

### Player Events

| Event | Description | Payload |
|-------|-------------|---------|
| `player:connected` | Player connected to game | `{ playerId, playerName, connectedAt }` |
| `player:disconnected` | Player disconnected from game | `{ playerId, playerName, disconnectedAt, reason? }` |

### Connection Events

| Event | Description | Payload |
|-------|-------------|---------|
| `connection:replaced` | Current connection replaced | `{ message }` |
| `session:reconnected` | Session reconnected | `{ success, session?, message? }` |

### Error Events

| Event | Description | Payload |
|-------|-------------|---------|
| `error` | Error occurred | `{ message, details? }` |

## Best Practices

1. **Error Handling**: Always listen for the `error` event to handle error cases
2. **Reconnection**: Handle `session:reconnected` for seamless reconnection experience
3. **State Synchronization**: Use `game:state` to get full state after joining

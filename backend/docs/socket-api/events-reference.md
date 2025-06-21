# Socket API Events Reference

This document provides a comprehensive reference of all Socket.IO events used in the Fishbowl game.

## Event Naming Conventions

All events follow the standardized `colon:separated` pattern:
- `entity:action` - For simple events (e.g., `gameroom:join`)
- `entity:state` - For state-related events (e.g., `game:state`)

## Client-to-Server Events

Events that clients emit to the server:

### Game Room Events

| Event | Description | Payload |
|-------|-------------|---------|
| `gameroom:join` | Join a game room | `{ gameCode, playerId, playerName, deviceId }` |
| `gameroom:leave` | Leave a game room | `{ gameCode, playerId }` |

## Server-to-Client Events

Events that the server emits to clients:

### Game Room Events

| Event | Description | Payload |
|-------|-------------|---------|
| `gameroom:joined` | Confirmation of joining a game room | `{ gameCode, playerId, playerName, connectedAt }` |
| `gameroom:player:joined` | When a player connected to game room | `{ playerId, playerName, connectedAt }` |
| `gameroom:player:left` | When a player disconnected from game room | `{ playerId, playerName, disconnectedAt, reason? }` |

### Game Events

| Event | Description | Payload |
|-------|-------------|---------|
| `game:state` | Complete game state | `{ gameCode, game, teams, players, updatedAt }` |
| `game:started` | Game has started | `{ gameCode, startedAt }` |
| `round:started` | Round has started | `{ gameCode, round, roundName, startedAt }` |
| `round:ended` | Round has ended | `{ gameCode, round, roundScores, endedAt }` |
| `turn:started` | Turn has started | `{ gameCode, round, playerName, teamName, startedAt }` |
| `turn:paused` | Turn has been paused | `{ gameCode, round, playerName, pausedAt, pausedReason }` |
| `turn:ended` | Turn has ended | `{ gameCode, round, playerName, phrasesGuessed, phrasesSkipped, pointsScored, endedAt }` |

### Connection Events

| Event | Description | Payload |
|-------|-------------|---------|
| `connection:replaced` | Notifies an existing socket that it's being disconnected because the same player connected from a different socket | `{ message }` |

### Error Events

| Event | Description | Payload |
|-------|-------------|---------|
| `error` | Error occurred | `{ message, details? }` |

### System Events

| Event | Description | Payload |
|-------|-------------|---------|
| `ping` | Heartbeat request from client | `{ deviceId?, gameCode? }` |
| `pong` | Heartbeat response from server | none |

## Best Practices

1. **Error Handling**: Always listen for the `error` event to handle error cases
2. **State Synchronization**: Use `game:state` to get full state after joining

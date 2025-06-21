# Socket API Documentation

## Overview

The Fishbowl Socket API provides real-time functionality for the game through Socket.IO, enabling players to receive instant updates about game state changes, player connections, and team assignments.

## Event Naming Conventions

All Socket.IO events follow a standardized `colon:separated` naming pattern for consistency:

- Client-to-server events: `entity:action` (e.g., `gameroom:join`)
- Server-to-client events: `entity:action` or `entity:state` (e.g., `gameroom:player:joined`, `game:state`)

## Socket Connection Lifecycle

1. **Connection**: Client connects to Socket.IO server
2. **Authentication**: Client joins a game room using the `gameroom:join` event
3. **Real-time Updates**: Client receives updates through various events
4. **Disconnection**: Client leaves explicitly with `gameroom:leave` or through socket disconnection

## Key Features

- **Game Room Management**: Join/leave game rooms
- **Player Connection Tracking**: Monitor who's online in real-time
- **Team Assignment Broadcasting**: Synchronize team changes across all clients
- **Game State Updates**: Broadcast game state changes to all players
- **Device Session Management**: Handle multiple devices per player

## Integration with REST API

The Socket API complements the REST API:

- **REST API**: Used for data mutations (creating games, joining teams, submitting phrases)
- **Socket API**: Used for real-time updates and notifications

For details on specific events and payloads, see [Events Reference](events-reference.md).

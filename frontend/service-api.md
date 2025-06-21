# Implement Comprehensive API Service Layer for Frontend-Backend Communication

Create a robust, type-safe service layer in the frontend that seamlessly integrates REST API, Socket.IO, and device session management functionality.

## Project Structure

Create the following structure in `frontend/src/services/`:
```
services/
├── api/
│   ├── index.ts                 # Main API service exports
│   ├── GameService.ts           # Core game service class
│   ├── SocketService.ts         # Socket.IO management service
│   ├── DeviceSessionService.ts  # Device session management
│   └── types/
│       ├── index.ts             # Type exports
│       ├── rest.types.ts        # REST API interfaces
│       ├── socket.types.ts      # Socket event interfaces
│       └── device.types.ts      # Device session interfaces
├── hooks/
│   ├── useGameService.ts        # React hook for GameService
│   ├── useSocketConnection.ts   # Socket connection status hook
│   └── useDeviceSession.ts      # Device session management hook
└── utils/
    ├── apiClient.ts             # Axios instance configuration
    ├── errorHandler.ts          # Centralized error handling
    └── connectionMonitor.ts     # Network status monitoring
```

## Core Requirements

### 1. GameService Class (`GameService.ts`)

Create a singleton service that:
- Integrates REST API calls from `rest-api.ts`
- Manages Socket.IO events from `SOCKET-API.ts`
- Handles device sessions from `deviceSessions.ts`
- Provides unified interface for all game operations
- Implements automatic retry logic for failed requests
- Manages authentication state (player ID, game code)
- Provides observable state for real-time updates

Key methods to implement:
- `createGame()` - REST + auto-join socket room
- `joinGame()` - REST + socket room + device session
- `submitPhrases()` - REST + broadcast updates via socket
- `assignToTeam()` - REST + socket notification
- `subscribeToGameUpdates()` - Socket event listeners
- `reconnectSession()` - Device session + socket reconnection

### 2. SocketService Class (`SocketService.ts`)

Dedicated Socket.IO management:
- Connection lifecycle management
- Automatic reconnection with exponential backoff
- Event emitter pattern for decoupled event handling
- Connection status monitoring (connected, connecting, disconnected)
- Queue for events sent while disconnected
- Heartbeat/ping mechanism for connection health

### 3. DeviceSessionService Class (`DeviceSessionService.ts`)

Device persistence and session management:
- Generate and persist device IDs in localStorage
- Automatic session recovery on page reload
- Track active sessions across games
- Handle multi-tab/window scenarios
- Session cleanup and expiration

## TypeScript Interfaces

### REST API Types (`rest.types.ts`)
- Mirror all request/response interfaces from `rest-api.ts`
- Add client-specific types for state management
- Include error response types

### Socket Event Types (`socket.types.ts`)
- Define all socket event payloads from `SOCKET-API.ts`
- Create discriminated unions for event types
- Include connection state types

### Device Session Types (`device.types.ts`)
- Session state interfaces
- Device identification types
- Reconnection result types

## React Integration

### Custom Hooks

1. **`useGameService`** - Primary hook for game operations
   - Provides GameService instance
   - Manages service lifecycle
   - Handles cleanup on unmount

2. **`useSocketConnection`** - Socket connection monitoring
   - Real-time connection status
   - Reconnection attempts counter
   - Last error information

3. **`useDeviceSession`** - Device session management
   - Current session state
   - Reconnection capabilities
   - Session history

## Error Handling & Resilience

### 1. Centralized Error Handler
- Categorize errors (network, validation, server, etc.)
- User-friendly error messages
- Retry strategies based on error type
- Error reporting/logging

### 2. Connection Monitoring
- Network online/offline detection
- Socket connection health checks
- Automatic reconnection orchestration
- Connection state synchronization

## Implementation Guidelines

### 1. State Management
- Use observables (RxJS) or event emitters for real-time updates
- Maintain local cache for offline support
- Implement optimistic updates where appropriate

### 2. Performance Optimization
- Debounce frequent operations
- Implement request deduplication
- Cache game state locally
- Lazy load socket connection

### 3. Security Considerations
- Store sensitive data securely
- Validate all inputs client-side
- Implement CSRF protection if needed
- Handle authentication expiration

### 4. Testing Strategy
- Mock socket connections for unit tests
- Create test utilities for service testing
- Implement integration tests for critical flows

## Example Usage

```typescript
// In a React component
const MyComponent = () => {
  const { gameService, isConnected } = useGameService();
  const { sessionState } = useDeviceSession();

  const handleCreateGame = async () => {
    try {
      const result = await gameService.createGame({
        name: 'My Game',
        hostPlayerName: 'Player 1'
      });
      // Automatically connected to socket room
    } catch (error) {
      // Handled by central error handler
    }
  };

  // Real-time updates via subscription
  useEffect(() => {
    const subscription = gameService.onGameStateUpdate((update) => {
      // Handle game state changes
    });
    return () => subscription.unsubscribe();
  }, []);
};
```

## Deliverables
1. Fully typed service layer with 100% type coverage
2. Comprehensive error handling and recovery
3. Automatic reconnection and session management
4. React hooks for easy integration
5. Documentation with usage examples
6. Unit test setup and examples
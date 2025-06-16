# Fishbowl Backend Documentation

Welcome to the Fishbowl backend documentation. This guide provides comprehensive information about the backend architecture, APIs, database design, and development practices for the Fishbowl PWA game.

## 📚 Documentation Overview

### 🎮 [REST API Documentation](./REST-API/README.md)
Complete REST API reference for the Fishbowl backend, including:
- [Game Management Endpoints](./REST-API/game-endpoints.md) - Create, configure, and manage games
- [Player Management Endpoints](./REST-API/player-endpoints.md) - Player registration and team assignments
- [Phrase Management Endpoints](./REST-API/phrase-endpoints.md) - Phrase submission and tracking
- [Turn Management Endpoints](./REST-API/turn-endpoints.md) - Turn progression and circular draft order
- [Device Session Endpoints](./REST-API/device-session-endpoints.md) - Device tracking and session management

### 🗄️ [Database Documentation](./database/README.md)
Comprehensive database module documentation, including:
- [Database Schema](./database/schema.md) - Complete entity relationships and table definitions
- Connection management and pooling
- Migration system
- Transaction support
- Environment-specific configurations

### 🧪 [Unit Testing Guide](./Unittests/README.md)
Complete guide to writing and running tests for the backend:
- Test structure and organization
- Test helpers and factories
- Writing effective tests
- Common test patterns
- Best practices

### 📦 [NPM Scripts Reference](./npm-scripts.md)
Detailed explanation of all available npm scripts:
- Development and production commands
- Testing and code quality scripts
- Database management utilities
- Common workflows

## 🏗️ Architecture Overview

The Fishbowl backend is built with:
- **Express.js** with TypeScript for the REST API
- **Socket.IO** for real-time communication
- **SQLite** for data persistence
- **Jest** for comprehensive testing

### Key Features
- ✅ RESTful API with comprehensive endpoints
- ✅ Real-time WebSocket communication
- ✅ Robust database schema with migrations
- ✅ Device session management

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/   # REST API route handlers
│   ├── db/            # Database connection and utilities
│   ├── routes/        # Express route definitions
│   ├── sockets/       # Socket.IO event handlers
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── unittests/         # Comprehensive test suite
├── docs/              # This documentation
└── dist/              # Compiled JavaScript (build output)
```

## 🔗 Key Concepts

### Game Flow
Games progress through three main phases with detailed sub-statuses:
- **Setup Phase** - Player joining and phrase submission
- **Playing Phase** - Active gameplay with turns and rounds
- **Finished Phase** - Game completion and final scores

See the [Database Schema](./database/schema.md#game-status-flow) for detailed status transitions.

### Session Management
Device sessions enable:
- Player reconnection after disconnection
- Multi-device tracking
- Real-time connection status
- Cross-game session support

Details in the [Device Session Endpoints](./REST-API/device-session-endpoints.md).

## 🛠️ Development

### Environment Variables
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment mode (development/production/test)
- `DB_PATH` - Database file path
- `DB_TIMEOUT` - Database connection timeout
- `CREATE_SAMPLE_DATA` - Create sample data in development

---

**Happy coding!** 🎮🎣
## Relevant Files

### Backend Files (Existing)
- `/backend/jest.config.js` - Jest testing configuration for backend
- `/backend/src/server.ts` - Main Express server setup with Socket.IO integration
- `/backend/src/routes/REST-API.ts` - REST API endpoints for game management
- `/backend/src/routes/README.md` - Documentation for REST API routes
- `/backend/src/sockets/SOCKET-API.ts` - Socket.IO event handlers for real-time updates
- `/backend/src/db/schema.ts` - SQLite database schema definitions
- `/backend/src/db/connection.ts` - Database connection management
- `/backend/src/db/index.ts` - Database module exports
- `/backend/src/db/init.ts` - Database initialization
- `/backend/src/db/migrator.ts` - Database migration management
- `/backend/src/db/utils.ts` - Database utility functions
- `/backend/src/db/verify.ts` - Database verification functions
- `/backend/src/db/README.md` - Documentation for database module
- `/backend/src/db/migrations/001_initial.ts` - Initial database migration
- `/backend/src/db/migrations/002_device_sessions.ts` - Device sessions table migration
- `/backend/src/db/migrations/index.ts` - Migration exports
- `/backend/src/sockets/deviceSessionManager.ts` - Device session management utilities
- `/backend/src/routes/deviceSessions.ts` - REST API endpoints for device sessions
- `/backend/unittests/setupTests.ts` - Backend test setup file
- `/backend/unittests/setup.test.ts` - Basic test to verify Jest setup
- `/backend/unittests/db/database.test.ts` - Unit tests for database functions
- `/backend/unittests/routes/gameConfig.test.ts` - Unit tests for game configuration routes
- `/backend/unittests/routes/games.test.ts` - Unit tests for game routes
- `/backend/unittests/routes/phrases.test.ts` - Unit tests for phrase routes
- `/backend/unittests/routes/players.test.ts` - Unit tests for player routes
- `/backend/unittests/routes/test-utils.ts` - Testing utilities for routes
- `/backend/unittests/sockets/gameHandlers.test.ts` - Unit tests for socket handlers
- `/backend/database/fishbowl.db` - SQLite database file (generated)

### Frontend Files (Existing)
- `/frontend/src/App.tsx` - Main React app component with routing
- `/frontend/src/App.test.tsx` - Unit tests for App component
- `/frontend/src/App.css` - Styles for App component
- `/frontend/src/HomePage.tsx` - Home page component with navigation to New Game/Join Game
- `/frontend/src/NewGamePage.tsx` - Page for creating a new game with configuration options.
- `/frontend/src/index.tsx` - React app entry point
- `/frontend/src/index.css` - Global styles
- `/frontend/src/setupTests.ts` - Frontend test setup file
- `/frontend/src/service-worker.ts` - Service worker for offline functionality
- `/frontend/src/serviceWorkerRegistration.ts` - Service worker registration
- `/frontend/src/reportWebVitals.ts` - Web vitals reporting

### Project Documentation
- `/README.md` - Project documentation
- `/fishbowl_app_requirements.md` - Application requirements

### Notes

- Unit tests should typically be placed in the unittest directory ex: backend/unittests and be name similar (e.g., `MyComponent.tsx` and `MyComponent.test.tsx`).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Set up project structure and development environment
  - [x] 1.1 Create the three main directories: `/frontend`, `/backend`, and `/database`
  - [x] 1.2 Initialize the frontend React app with TypeScript using Create React App with PWA template
  - [x] 1.3 Initialize the backend Node.js project with TypeScript and configure tsconfig.json
  - [x] 1.4 Install necessary dependencies for backend (Express, Socket.IO, SQLite3, cors, body-parser)
  - [x] 1.5 Install necessary dependencies for frontend (Redux Toolkit, Socket.IO client, React Router, chosen UI framework)
  - [x] 1.6 Configure Jest for both frontend and backend testing  
  - [x] 1.7 Set up Prettier for code consistency
  - [x] 1.8 Create initial package.json scripts for development, testing, and building
  - [x] 1.9 Create Readme.md to describe the project structure and development environment and how to use

- [ ] 2.0 Implement backend API and real-time communication infrastructure
  - [x] 2.1 Create Express server with middleware setup (cors, body-parser, static file serving)
  - [x] 2.2 Design and implement SQLite database schema (games, players, teams, phrases, turns tables)
  - [x] 2.3 Create database connection module and migration system
  - [x] 2.4 Implement REST API endpoints for game creation and joining
  - [x] 2.5 Implement REST API endpoints for player and team management
  - [x] 2.6 Implement REST API endpoints for phrase submission and retrieval
  - [x] 2.7 Set up Socket.IO server and connection handling
  - [x] 2.8 Implement Socket.IO event handlers for game state synchronization
  - [x] 2.9 Create device session management for reconnection handling
  - [x] 2.10 Write unit tests for all API endpoints and socket handlers

- [ ] 3.0 Build core game management features (lobby, setup, player management)
  - [x] 3.1 Create Home page component with navigation to New Game/Join Game
  - [x] 3.2 Implement game creation flow with configuration options (teams, phrases per player, timer)
  - [ ] 3.3 Build game code generation and QR code display functionality
  - [ ] 3.4 Create Join Game screen with code input and validation
  - [ ] 3.5 Develop Lobby page with player list and team assignment UI
  - [ ] 3.6 Implement real-time player joining updates using Socket.IO
  - [ ] 3.7 Build phrase submission screen with progress tracking
  - [ ] 3.8 Create Redux store structure for game state management
  - [ ] 3.9 Implement API service layer for backend communication/frontend integration
    - [ ] 3.9.1 Create GameService class that handles both REST API and Socket.IO communication
    - [ ] 3.9.2 Implement all necessary calls for both APIs combining where appropriate
      - [ ] 3.9.2.1 Create TypeScript interfaces for all service method responses
    - [ ] 3.9.8 Implement connection status monitoring and reconnection handling
    - [ ] 3.9.9 Write comprehensive unit tests for GameService module
    - [ ] 3.9.10 Integrate GameService with React components and Redux store
  - [ ] 3.10 Write unit tests for all components and Redux logic

- [ ] 4.0 Develop in-game functionality (rounds, turns, scoring)
  - [ ] 4.1 Create main Game page component with round/turn state display
  - [ ] 4.2 Implement timer functionality with start/pause/stop controls
  - [ ] 4.3 Build phrase display system for controlling device only
  - [ ] 4.4 Create "Guessed" and "Skip" button functionality with score updates
  - [ ] 4.5 Implement turn rotation logic following snake draft pattern
  - [ ] 4.6 Develop round transition screens with score summaries
  - [ ] 4.7 Build different UI states for controlling vs non-controlling devices
  - [ ] 4.8 Create end-game screen with final scores and replay options
  - [ ] 4.9 Implement real-time score and state updates across all devices
  - [ ] 4.10 Add connection status indicators and reconnection handling
  - [ ] 4.11 Write comprehensive tests for game flow and state management

- [ ] 5.0 Create PWA features and deployment configuration
  - [ ] 5.1 Configure PWA manifest.json with app metadata and icons
  - [ ] 5.2 Implement service worker for offline caching strategies
  - [ ] 5.3 Add install prompt and PWA installation flow
  - [ ] 5.4 Set up responsive design for various screen sizes
  - [ ] 5.5 Configure production build scripts for both frontend and backend
  - [ ] 5.6 Create deployment configuration for single-server setup
  - [ ] 5.7 Add error handling and logging for production environment
  - [ ] 5.8 Implement graceful error recovery for network issues
  - [ ] 5.9 Test PWA features (offline mode, installation, updates)
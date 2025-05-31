## Relevant Files

- `/backend/package.json` - Node.js project configuration with TypeScript setup
- `/backend/tsconfig.json` - TypeScript compiler configuration
- `/backend/jest.config.js` - Jest testing configuration for backend
- `/backend/src/setupTests.ts` - Backend test setup file
- `/backend/src/setup.test.ts` - Basic test to verify Jest setup
- `/backend/src/` - Backend source code directory
- `/backend/src/server.ts` - Main Express server setup with Socket.IO integration
- `/backend/src/server.test.ts` - Unit tests for server setup
- `/backend/src/routes/gameRoutes.ts` - REST API endpoints for game management
- `/backend/src/routes/gameRoutes.test.ts` - Unit tests for game routes
- `/backend/src/sockets/gameHandlers.ts` - Socket.IO event handlers for real-time updates
- `/backend/src/sockets/gameHandlers.test.ts` - Unit tests for socket handlers
- `/backend/src/db/schema.ts` - SQLite database schema definitions
- `/backend/src/db/migrations/001_initial.ts` - Initial database migration
- `/backend/src/models/Game.ts` - Game model with business logic
- `/backend/src/models/Game.test.ts` - Unit tests for Game model
- `/frontend/src/App.tsx` - Main React app component with routing
- `/frontend/src/App.test.tsx` - Unit tests for App component
- `/frontend/src/pages/HomePage.tsx` - Home screen with game options
- `/frontend/src/pages/HomePage.test.tsx` - Unit tests for home page
- `/frontend/src/pages/LobbyPage.tsx` - Game lobby for player management
- `/frontend/src/pages/LobbyPage.test.tsx` - Unit tests for lobby page
- `/frontend/src/pages/GamePage.tsx` - Main game play screen
- `/frontend/src/pages/GamePage.test.tsx` - Unit tests for game page
- `/frontend/src/store/gameSlice.ts` - Redux slice for game state
- `/frontend/src/store/gameSlice.test.ts` - Unit tests for game slice
- `/frontend/src/services/api.ts` - API service layer
- `/frontend/src/services/api.test.ts` - Unit tests for API service
- `/frontend/src/services/socket.ts` - Socket.IO client service
- `/frontend/src/services/socket.test.ts` - Unit tests for socket service
- `/frontend/public/manifest.json` - PWA manifest configuration
- `/frontend/src/serviceWorker.ts` - Service worker for offline functionality
- `/database/fishbowl.db` - SQLite database file (generated)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Set up project structure and development environment
  - [x] 1.1 Create the three main directories: `/frontend`, `/backend`, and `/database`
  - [x] 1.2 Initialize the frontend React app with TypeScript using Create React App with PWA template
  - [x] 1.3 Initialize the backend Node.js project with TypeScript and configure tsconfig.json
  - [x] 1.4 Install necessary dependencies for backend (Express, Socket.IO, SQLite3, cors, body-parser)
  - [x] 1.5 Install necessary dependencies for frontend (Redux Toolkit, Socket.IO client, React Router, chosen UI framework)
  - [x] 1.6 Configure Jest for both frontend and backend testing  
  - [x] 1.7 Set up ESLint and Prettier for code consistency
  - [x] 1.8 Create initial package.json scripts for development, testing, and building
  - [x] 1.9 Create Readme.md to describe the project structure and development environment and how to use

- [ ] 2.0 Implement backend API and real-time communication infrastructure
  - [x] 2.1 Create Express server with middleware setup (cors, body-parser, static file serving)
  - [x] 2.2 Design and implement SQLite database schema (games, players, teams, phrases, turns tables)
  - [x] 2.3 Create database connection module and migration system
  - [x] 2.4 Implement REST API endpoints for game creation and joining
  - [x] 2.5 Implement REST API endpoints for player and team management
  - [x] 2.6 Implement REST API endpoints for phrase submission and retrieval
  - [ ] 2.7 Set up Socket.IO server and connection handling
  - [ ] 2.8 Implement Socket.IO event handlers for game state synchronization
  - [ ] 2.9 Create device session management for reconnection handling
  - [ ] 2.10 Write unit tests for all API endpoints and socket handlers

- [ ] 3.0 Build core game management features (lobby, setup, player management)
  - [ ] 3.1 Create Home page component with navigation to New Game/Join Game
  - [ ] 3.2 Implement game creation flow with configuration options (teams, phrases per player, timer)
  - [ ] 3.3 Build game code generation and QR code display functionality
  - [ ] 3.4 Create Join Game screen with code input and validation
  - [ ] 3.5 Develop Lobby page with player list and team assignment UI
  - [ ] 3.6 Implement real-time player joining updates using Socket.IO
  - [ ] 3.7 Build phrase submission screen with progress tracking
  - [ ] 3.8 Create Redux store structure for game state management
  - [ ] 3.9 Implement API service layer for backend communication
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
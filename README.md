# Fishbowl PWA Game 🎣

A multiplayer Progressive Web App for playing the popular party game Fishbowl, featuring real-time gameplay, multi-device support, and offline capabilities.

## 🎯 Overview

Fishbowl is a team-based word-guessing game that combines elements of Charades, Password, and Taboo. This PWA implementation allows players to:
- Create and join games with QR codes
- Play across multiple devices in real-time
- Enjoy offline gameplay with PWA features
- Track scores and game progress
- Experience a modern, responsive UI

## 🎮 Game Features

### Core Gameplay
- **3 Rounds**: Taboo-style, One Word, Charades
- **Team-based scoring** with round progression
- **Timer management** for turns and rounds
- **Word submission** and randomization

### Multi-device Support
- **QR code generation** for easy game joining
- **Real-time synchronization** across all devices
- **Host controls** for game management
- **Player status tracking**

### PWA Features
- **Offline functionality** with service worker
- **Install prompts** for mobile devices
- **Responsive design** for all screen sizes
- **Push notifications** for game events

## 🏗️ Project Structure

```
fishbowl-app/
├── .github/          # GitHub workflow configurations
├── frontend/         # React PWA application
│   ├── public/       # Static assets and PWA manifest
│   ├── src/          # React components and logic
│   ├── build/        # Production build output
│   └── package.json  # Frontend dependencies
├── backend/          # Express.js server
│   ├── docs/         # Backend server Documentation
│   ├── src/          # TypeScript server code
│   ├── unittests/    # Unit Tests for backend
│   ├── dist/         # Compiled JavaScript output
│   └── package.json  # Backend dependencies
├── database/         # SQLite database files
├── tasks/            # Development task documentation
├── package.json      # Root workspace configuration
└── fishbowl_app_requirements.md  # Project requirements
```

## 📋 Documentation

### Backend Documentation
- [Backend Docs Overview](./backend/docs/README.md) — API, database, testing, and more

## 🛠️ Technical Stack

### Frontend
- **React 18+** with TypeScript
- **Progressive Web App** features (service worker, manifest)
- **Material-UI (MUI)** for component library
- **Redux Toolkit** for state management
- **Socket.IO Client** for real-time communication
- **React Router** for navigation
- **QR Code utilities** for game joining

### Backend
- **Express.js** with TypeScript
- **Socket.IO** for real-time WebSocket communication
- **SQLite3** for database storage
- **CORS** and **body-parser** middleware

### Development Tools
- **TypeScript** for type safety
- **dprint** for code formatting
- **Jest** for testing (backend) & **React Testing Library** (frontend)
- **Concurrently** for parallel development

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 8.0.0

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fishbowl-app
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## 💻 Development

### Start Development Servers
Run both frontend and backend in development mode:
```bash
npm run dev
```

This starts:
- **Frontend**: `http://localhost:3000` (React dev server)
- **Backend**: `http://localhost:5000` (Express server with hot reload)

### Individual Development Servers
Start servers individually:
```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Watch Mode Testing
```bash
npm run test:watch
```

### Coverage Reports
```bash
npm run test:coverage
```

### Individual Testing
```bash
# Frontend tests
npm run test:frontend

# Backend tests
npm run test:backend
```

## 🔧 Code Quality

### Formatting
```bash
# Format all code
npm run format

# Check formatting
npm run format:check
```
## 🏗️ Building & Deployment

### Build Production Assets
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Clean Build Artifacts
```bash
# Clean build directories
npm run clean

# Clean everything including node_modules
npm run clean:all
```

## 📁 Directory Details

### Frontend (`/frontend`)
- `src/components/` - React components
- `src/pages/` - Page-level components
- `src/store/` - Redux store configuration
- `src/services/` - API and Socket.IO services
- `src/types/` - TypeScript type definitions
- `public/manifest.json` - PWA manifest
- `public/sw.js` - Service worker

### Backend (`/backend`)
- `src/controllers/` - Express route handlers (games, players, phrases, device sessions, turns)
- `src/db/` - Database connection, schema, migrations, and utilities
- `src/routes/` - REST API route definitions
- `src/sockets/` - Socket.IO event handlers and device session management
- `src/types/` - TypeScript type definitions for REST API interfaces
- `src/utils/` - Utility functions (validators, team assignment, turn management)
- `docs/` - Comprehensive API documentation and database schema
- `unittests/` - Jest test suites with 95%+ code coverage
- `database/` - SQLite database files and migrations

### Database (`/database`)
- SQLite database files
- Schema definitions
- Migration scripts

## � Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both frontend and backend in development |
| `npm run build` | Build both projects for production |
| `npm test` | Run all tests |
| `npm run format` | Format all code |
| `npm run validate` | Complete validation pipeline |
| `npm start` | Start production server |
| `npm run clean` | Clean build artifacts |

## 📄 License

This project is licensed under the MIT License.

## 🎯 Roadmap

- [ ] Complete backend API implementation
- [ ] Build core game components
- [ ] Implement real-time Socket.IO communication
- [ ] Add PWA offline features
- [ ] Deploy to production environment
- [ ] Add comprehensive testing suite
- [ ] Performance optimization
- [ ] Accessibility improvements

---

**Ready to play Fishbowl?** Start the development environment with `npm run dev` and begin building the ultimate party game experience! 🎉

# Fishbowl PWA Game 🎣

A multiplayer Progressive Web App for playing the popular party game Fishbowl, featuring real-time gameplay, multi-device support, and offline capabilities.

## 🎯 Overview

Fishbowl is a team-based word-guessing game that combines elements of Charades, Password, and Taboo. This PWA implementation allows players to:
- Create and join games with QR codes
- Play across multiple devices in real-time
- Enjoy offline gameplay with PWA features
- Track scores and game progress
- Experience a modern, responsive UI

## 🏗️ Project Structure

```
fishbowl-app/
├── frontend/           # React PWA application
│   ├── public/         # Static assets and PWA manifest
│   ├── src/           # React components and logic
│   ├── build/         # Production build output
│   └── package.json   # Frontend dependencies
├── backend/           # Express.js server
│   ├── src/           # TypeScript server code
│   ├── dist/          # Compiled JavaScript output
│   └── package.json   # Backend dependencies
├── database/          # SQLite database files
└── package.json       # Root workspace configuration
```

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
- **ESLint** v9 with flat config for code linting
- **Prettier** for code formatting
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

### Linting
```bash
# Check all code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Formatting
```bash
# Format all code
npm run format

# Check formatting
npm run format:check
```

### Validation Pipeline
Run complete validation (lint + format + tests):
```bash
npm run validate
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
- `src/controllers/` - Express route handlers
- `src/models/` - Data models and database schemas
- `src/services/` - Business logic services
- `src/middleware/` - Express middleware
- `src/socket/` - Socket.IO event handlers
- `src/types/` - TypeScript type definitions

### Database (`/database`)
- SQLite database files
- Schema definitions
- Migration scripts

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

## 📊 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both frontend and backend in development |
| `npm run build` | Build both projects for production |
| `npm test` | Run all tests |
| `npm run lint` | Lint all code |
| `npm run format` | Format all code |
| `npm run validate` | Complete validation pipeline |
| `npm start` | Start production server |
| `npm run clean` | Clean build artifacts |

## 🤝 Contributing

1. **Follow the code style** - ESLint and Prettier configurations are enforced
2. **Write tests** - Maintain test coverage for new features
3. **Use TypeScript** - All code should be properly typed
4. **Validate changes** - Run `npm run validate` before committing

## 📋 Development Workflow

1. **Create feature branch** from main
2. **Install dependencies** if needed: `npm run install:all`
3. **Start development** with: `npm run dev`
4. **Write code** following established patterns
5. **Add tests** for new functionality
6. **Validate code** with: `npm run validate`
7. **Build project** with: `npm run build`
8. **Submit pull request**

## 🐛 Troubleshooting

### Common Issues

**Port conflicts**: Default ports are 3000 (frontend) and 5000 (backend)
```bash
# Change ports in package.json scripts or set environment variables
PORT=3001 npm run dev:frontend
```

**TypeScript errors**: Ensure all dependencies are installed
```bash
npm run install:all
```

**Build failures**: Clean and rebuild
```bash
npm run clean
npm run install:all
npm run build
```

**Test failures**: Check test environment setup
```bash
npm run test:backend
npm run test:frontend
```

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

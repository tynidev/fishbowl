import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeForEnvironment, getDatabaseStatus, cleanup } from './db';
import gameRoutes from './routes/gameRoutes';

// Initialize Express application
const app: Application = express();
const port = process.env.PORT || 3001;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false // Will be configured for production domain
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? false // Will be configured for production domain
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware setup
app.use(cors(corsOptions));

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving middleware
app.use('/static', express.static(path.join(__dirname, '../../frontend/build/static')));
app.use(express.static(path.join(__dirname, '../../frontend/build')));

// Request logging middleware (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
});

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbStatus = await getDatabaseStatus();
    res.json({
      status: dbStatus.healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        healthy: dbStatus.healthy,
        environment: dbStatus.environment
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Database status endpoint (detailed information)
app.get('/api/database/status', async (req: Request, res: Response) => {
  try {
    const status = await getDatabaseStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Game routes
app.use('/api', gameRoutes);

// API routes placeholder
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Fishbowl Game API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      database: '/api/database/status',
      games: {
        create: 'POST /api/games',
        join: 'POST /api/games/:gameCode/join',
        info: 'GET /api/games/:gameCode',
        players: 'GET /api/games/:gameCode/players',
        config: 'PUT /api/games/:gameCode/config'
      }
    }
  });
});

// Serve React app for all other routes (SPA fallback)
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
});

// Catch-all route for SPA - more explicit pattern
app.use((req: Request, res: Response) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
  });
  
  // Placeholder for game-specific socket events
  socket.on('join-game', (gameCode: string) => {
    console.log(`Socket ${socket.id} joining game: ${gameCode}`);
    socket.join(gameCode);
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  try {
    // Close database connections
    await cleanup();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error during database cleanup:', error);
  }
  
  // Close HTTP server
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    const dbResult = await initializeForEnvironment();
    
    if (!dbResult.success) {
      console.error('Database initialization failed:', dbResult.errors);
      process.exit(1);
    }
    
    console.log(`Database initialized successfully at: ${dbResult.databasePath}`);
    console.log(`Migration status: ${dbResult.migrationStatus?.isUpToDate ? 'Up to date' : 'Needs migration'}`);
    
    if (dbResult.sampleDataCreated) {
      console.log('Sample data created for development');
    }
    
    // Start HTTP server
    httpServer.listen(port, () => {
      console.log(`🎣 Fishbowl Game Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Socket.IO enabled on port ${port}`);
      console.log(`Database: ${dbResult.databasePath}`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this is the main module
if (require.main === module) {
  startServer();
}

// Export for testing
export { app, httpServer, io };
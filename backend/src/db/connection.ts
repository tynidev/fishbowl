// Database connection module for SQLite
// Handles database initialization, connection management, and utilities

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

// Enable verbose mode in development
if (process.env.NODE_ENV !== 'production') {
  sqlite3.verbose();
}

export interface DatabaseConfig {
  filename: string;
  mode?: number;
  timeout?: number;
  maxConnections?: number;
}

export interface DatabaseConnection {
  db: sqlite3.Database;
  run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
  all: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  exec: (sql: string) => Promise<void>;
  serialize: (callback: () => Promise<void>) => Promise<void>;
  close: () => Promise<void>;
  isHealthy: () => Promise<boolean>;
}

export interface TransactionConnection extends DatabaseConnection {
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

class DatabaseManager {
  private connections: Map<string, sqlite3.Database> = new Map();
  private config: DatabaseConfig;
  private isInitialized = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize database connection and ensure database file exists
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.filename);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`Created database directory: ${dbDir}`);
      }

      // Test connection
      const connection = await this.createConnection();
      await connection.isHealthy();
      await connection.close();

      this.isInitialized = true;
      console.log(`Database initialized: ${this.config.filename}`);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create a new database connection with promisified methods
   */
  async createConnection(): Promise<DatabaseConnection> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(
        this.config.filename,
        this.config.mode || sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) {
            console.error('Failed to create database connection:', err);
            reject(err);
            return;
          }

          // Configure database settings
          db.configure('busyTimeout', this.config.timeout || 5000);

          // Promisify database methods
          const connection: DatabaseConnection = {
            db,
            run: promisify(db.run.bind(db)),
            get: promisify(db.get.bind(db)),
            all: promisify(db.all.bind(db)),
            exec: promisify(db.exec.bind(db)),
            serialize: (callback: () => Promise<void>) => {
              return new Promise((resolveSerialize, rejectSerialize) => {
                db.serialize(async () => {
                  try {
                    await callback();
                    resolveSerialize();
                  } catch (error) {
                    rejectSerialize(error);
                  }
                });
              });
            },
            close: () => {
              return new Promise((resolveClose, rejectClose) => {
                db.close((err) => {
                  if (err) {
                    rejectClose(err);
                  } else {
                    resolveClose();
                  }
                });
              });
            },
            isHealthy: async () => {
              try {
                await connection.get('SELECT 1 as test');
                return true;
              } catch (error) {
                console.error('Database health check failed:', error);
                return false;
              }
            }
          };

          resolve(connection);
        }
      );
    });
  }

  /**
   * Create a transaction wrapper with commit/rollback functionality
   */
  async createTransaction(): Promise<TransactionConnection> {
    const connection = await this.createConnection();
    let isTransactionActive = false;

    try {
      await connection.exec('BEGIN TRANSACTION');
      isTransactionActive = true;

      const transaction: TransactionConnection = {
        ...connection,
        commit: async () => {
          if (isTransactionActive) {
            await connection.exec('COMMIT');
            isTransactionActive = false;
          }
        },
        rollback: async () => {
          if (isTransactionActive) {
            await connection.exec('ROLLBACK');
            isTransactionActive = false;
          }
        },
        close: async () => {
          if (isTransactionActive) {
            try {
              await connection.exec('ROLLBACK');
            } catch (error) {
              console.warn('Failed to rollback transaction during close:', error);
            }
          }
          await connection.close();
        }
      };

      return transaction;
    } catch (error) {
      await connection.close();
      throw error;
    }
  }

  /**
   * Get database statistics and information
   */
  async getStats(): Promise<any> {
    const connection = await this.createConnection();
    try {
      const [
        version,
        pragmaInfo,
        tableCount,
        indexCount
      ] = await Promise.all([
        connection.get('SELECT sqlite_version() as version'),
        connection.get('PRAGMA database_list'),
        connection.get('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"'),
        connection.get('SELECT COUNT(*) as count FROM sqlite_master WHERE type="index"')
      ]);

      return {
        sqliteVersion: version?.version,
        databaseFile: this.config.filename,
        fileSize: this.getDatabaseFileSize(),
        tableCount: tableCount?.count || 0,
        indexCount: indexCount?.count || 0,
        pragmaInfo,
        lastModified: this.getDatabaseLastModified()
      };
    } finally {
      await connection.close();
    }
  }

  /**
   * Cleanup all connections
   */
  async cleanup(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(db => {
      return new Promise<void>((resolve) => {
        db.close((err) => {
          if (err) {
            console.warn('Error closing database connection:', err);
          }
          resolve();
        });
      });
    });

    await Promise.all(closePromises);
    this.connections.clear();
    this.isInitialized = false;
    console.log('Database connections cleaned up');
  }

  private getDatabaseFileSize(): number {
    try {
      const stats = fs.statSync(this.config.filename);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  private getDatabaseLastModified(): Date | null {
    try {
      const stats = fs.statSync(this.config.filename);
      return stats.mtime;
    } catch (error) {
      return null;
    }
  }
}

// Default database configuration
const getDefaultConfig = (): DatabaseConfig => {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'database', 'fishbowl.db');
  
  return {
    filename: dbPath,
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    timeout: parseInt(process.env.DB_TIMEOUT || '5000'),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10')
  };
};

// Singleton database manager instance
let dbManager: DatabaseManager | null = null;

/**
 * Initialize the database manager with optional config
 */
export async function initializeDatabase(config?: Partial<DatabaseConfig>): Promise<void> {
  const finalConfig = { ...getDefaultConfig(), ...config };
  dbManager = new DatabaseManager(finalConfig);
  await dbManager.initialize();
}

/**
 * Get a database connection
 */
export async function getConnection(): Promise<DatabaseConnection> {
  if (!dbManager) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return await dbManager.createConnection();
}

/**
 * Get a transaction connection
 */
export async function getTransaction(): Promise<TransactionConnection> {
  if (!dbManager) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return await dbManager.createTransaction();
}

/**
 * Execute a function within a transaction
 */
export async function withTransaction<T>(
  callback: (connection: TransactionConnection) => Promise<T>
): Promise<T> {
  const transaction = await getTransaction();
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await transaction.close();
  }
}

/**
 * Execute a function with a database connection
 */
export async function withConnection<T>(
  callback: (connection: DatabaseConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();
  try {
    return await callback(connection);
  } finally {
    await connection.close();
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<any> {
  if (!dbManager) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return await dbManager.getStats();
}

/**
 * Perform database health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    return await withConnection(async (connection) => {
      return await connection.isHealthy();
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Cleanup database connections
 */
export async function cleanup(): Promise<void> {
  if (dbManager) {
    await dbManager.cleanup();
    dbManager = null;
  }
}

// Graceful shutdown handling
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
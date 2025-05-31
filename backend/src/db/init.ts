// Database initialization module
// Handles database setup on application startup

import { initializeDatabase, healthCheck, getDatabaseStats } from './connection';
import { initializeSchema, getMigrationStatus } from './migrator';
import { createSampleData } from './migrations/001_initial';
import path from 'path';

export interface InitializationResult {
  success: boolean;
  databasePath: string;
  migrationStatus: any;
  stats: any;
  sampleDataCreated: boolean;
  errors: string[];
}

/**
 * Initialize database for development environment
 */
export async function initializeDevelopmentDatabase(): Promise<InitializationResult> {
  const errors: string[] = [];
  let sampleDataCreated = false;

  try {
    console.log('Initializing development database...');

    // Initialize database connection
    const dbPath = path.join(process.cwd(), 'database', 'fishbowl.db');
    await initializeDatabase({ filename: dbPath });

    // Run migrations
    await initializeSchema();

    // Get migration status
    const migrationStatus = await getMigrationStatus();

    // Create sample data in development
    if (process.env.NODE_ENV === 'development' || process.env.CREATE_SAMPLE_DATA === 'true') {
      try {
        const { withConnection } = await import('./connection');
        await withConnection(async (connection) => {
          await createSampleData(connection);
        });
        sampleDataCreated = true;
        console.log('Sample data created for development');
      } catch (error) {
        // Sample data creation is not critical
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn('Failed to create sample data:', errorMsg);
        errors.push(`Sample data creation failed: ${errorMsg}`);
      }
    }

    // Get database stats
    const stats = await getDatabaseStats();

    console.log('Development database initialization completed');

    return {
      success: true,
      databasePath: dbPath,
      migrationStatus,
      stats,
      sampleDataCreated,
      errors
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Development database initialization failed:', errorMsg);
    errors.push(errorMsg);

    return {
      success: false,
      databasePath: '',
      migrationStatus: null,
      stats: null,
      sampleDataCreated: false,
      errors
    };
  }
}

/**
 * Initialize database for production environment
 */
export async function initializeProductionDatabase(): Promise<InitializationResult> {
  const errors: string[] = [];

  try {
    console.log('Initializing production database...');

    // Initialize database connection
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'database', 'fishbowl.db');
    await initializeDatabase({ 
      filename: dbPath,
      timeout: 10000 // Longer timeout for production
    });

    // Run migrations
    await initializeSchema();

    // Get migration status
    const migrationStatus = await getMigrationStatus();

    // Verify database health
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }

    // Get database stats
    const stats = await getDatabaseStats();

    console.log('Production database initialization completed');

    return {
      success: true,
      databasePath: dbPath,
      migrationStatus,
      stats,
      sampleDataCreated: false,
      errors
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Production database initialization failed:', errorMsg);
    errors.push(errorMsg);

    return {
      success: false,
      databasePath: '',
      migrationStatus: null,
      stats: null,
      sampleDataCreated: false,
      errors
    };
  }
}

/**
 * Initialize database based on environment
 */
export async function initializeForEnvironment(): Promise<InitializationResult> {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return await initializeProductionDatabase();
    case 'test':
      return await initializeTestDatabase();
    default:
      return await initializeDevelopmentDatabase();
  }
}

/**
 * Initialize database for testing environment
 */
export async function initializeTestDatabase(): Promise<InitializationResult> {
  const errors: string[] = [];

  try {
    console.log('Initializing test database...');

    // Use in-memory database for tests
    const dbPath = ':memory:';
    await initializeDatabase({ filename: dbPath });

    // Run migrations
    await initializeSchema();

    // Get migration status
    const migrationStatus = await getMigrationStatus();

    // Get database stats
    const stats = await getDatabaseStats();

    console.log('Test database initialization completed');

    return {
      success: true,
      databasePath: dbPath,
      migrationStatus,
      stats,
      sampleDataCreated: false,
      errors
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Test database initialization failed:', errorMsg);
    errors.push(errorMsg);

    return {
      success: false,
      databasePath: '',
      migrationStatus: null,
      stats: null,
      sampleDataCreated: false,
      errors
    };
  }
}

/**
 * Verify database integrity
 */
export async function verifyDatabaseIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Check database health
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      issues.push('Database health check failed');
    }

    // Check migration status
    const migrationStatus = await getMigrationStatus();
    if (!migrationStatus.isUpToDate) {
      issues.push(`Database schema is not up to date. Current: ${migrationStatus.currentVersion}, Latest: ${migrationStatus.latestVersion}`);
    }

    // Verify schema integrity using the existing validation
    const { withConnection } = await import('./connection');
    const { validateSchema } = await import('./migrations/001_initial');
    
    const schemaValid = await withConnection(async (connection) => {
      return await validateSchema(connection);
    });

    if (!schemaValid) {
      issues.push('Database schema validation failed');
    }

    return {
      valid: issues.length === 0,
      issues
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    issues.push(`Database integrity check failed: ${errorMsg}`);
    
    return {
      valid: false,
      issues
    };
  }
}

/**
 * Get database status information
 */
export async function getDatabaseStatus(): Promise<any> {
  try {
    const [migrationStatus, stats, integrity] = await Promise.all([
      getMigrationStatus(),
      getDatabaseStats(),
      verifyDatabaseIntegrity()
    ]);

    return {
      healthy: await healthCheck(),
      migration: migrationStatus,
      stats,
      integrity,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Reset database (development only)
 */
export async function resetDatabaseForDevelopment(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database reset is not allowed in production');
  }

  console.log('Resetting development database...');

  try {
    const { resetDatabase } = await import('./migrator');
    await resetDatabase();
    await initializeSchema();
    
    // Recreate sample data
    if (process.env.NODE_ENV === 'development') {
      const { withConnection } = await import('./connection');
      await withConnection(async (connection) => {
        await createSampleData(connection);
      });
    }

    console.log('Database reset completed');

  } catch (error) {
    console.error('Database reset failed:', error);
    throw error;
  }
}
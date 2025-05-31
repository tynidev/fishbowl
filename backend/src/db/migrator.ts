// Database migration runner
// Handles running migrations up and down, tracking migration state

import { DatabaseConnection, getConnection, withTransaction } from './connection';
import { MIGRATIONS, getMigrationByVersion, getLatestMigrationVersion } from './migrations';
import type { Migration } from './migrations';

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
  execution_time_ms: number;
}

export interface MigrationResult {
  success: boolean;
  version: number;
  name: string;
  executionTime: number;
  error?: string;
}

export interface MigrationStatus {
  currentVersion: number;
  latestVersion: number;
  pendingMigrations: Migration[];
  appliedMigrations: MigrationRecord[];
  isUpToDate: boolean;
}

class MigrationRunner {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable(): Promise<void> {
    await this.connection.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  /**
   * Get current schema version from database
   */
  async getCurrentVersion(): Promise<number> {
    try {
      await this.initializeMigrationTable();
      const result = await this.connection.get<{ version: number }>(`
        SELECT version FROM schema_migrations 
        ORDER BY version DESC 
        LIMIT 1
      `);
      return result?.version || 0;
    } catch (error) {
      console.error('Failed to get current migration version:', error);
      return 0;
    }
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      await this.initializeMigrationTable();
      return await this.connection.all<MigrationRecord>(`
        SELECT version, name, applied_at, execution_time_ms
        FROM schema_migrations 
        ORDER BY version ASC
      `);
    } catch (error) {
      console.error('Failed to get applied migrations:', error);
      return [];
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = getLatestMigrationVersion();
    const appliedMigrations = await this.getAppliedMigrations();
    
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    const pendingMigrations = MIGRATIONS.filter(m => !appliedVersions.has(m.version));

    return {
      currentVersion,
      latestVersion,
      pendingMigrations,
      appliedMigrations,
      isUpToDate: currentVersion >= latestVersion && pendingMigrations.length === 0
    };
  }

  /**
   * Run a single migration up
   */
  async runMigrationUp(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Running migration ${migration.version}: ${migration.name}`);
      
      await migration.up(this.connection);
      
      const executionTime = Date.now() - startTime;
      
      // Record migration in tracking table
      await this.connection.run(`
        INSERT OR REPLACE INTO schema_migrations (version, name, applied_at, execution_time_ms)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?)
      `, [migration.version, migration.name, executionTime]);

      console.log(`Migration ${migration.version} completed in ${executionTime}ms`);
      
      return {
        success: true,
        version: migration.version,
        name: migration.name,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`Migration ${migration.version} failed:`, errorMessage);
      
      return {
        success: false,
        version: migration.version,
        name: migration.name,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Run a single migration down
   */
  async runMigrationDown(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
      
      await migration.down(this.connection);
      
      const executionTime = Date.now() - startTime;
      
      // Remove migration from tracking table
      await this.connection.run(`
        DELETE FROM schema_migrations WHERE version = ?
      `, [migration.version]);

      console.log(`Migration ${migration.version} rolled back in ${executionTime}ms`);
      
      return {
        success: true,
        version: migration.version,
        name: migration.name,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`Migration ${migration.version} rollback failed:`, errorMessage);
      
      return {
        success: false,
        version: migration.version,
        name: migration.name,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Run all pending migrations up
   */
  async migrateUp(): Promise<MigrationResult[]> {
    const status = await this.getStatus();
    const results: MigrationResult[] = [];

    if (status.pendingMigrations.length === 0) {
      console.log('No pending migrations to run');
      return results;
    }

    console.log(`Running ${status.pendingMigrations.length} pending migrations`);

    for (const migration of status.pendingMigrations.sort((a, b) => a.version - b.version)) {
      const result = await this.runMigrationUp(migration);
      results.push(result);
      
      if (!result.success) {
        console.error(`Migration ${migration.version} failed, stopping migration process`);
        break;
      }
    }

    return results;
  }

  /**
   * Roll back migrations to a specific version
   */
  async migrateTo(targetVersion: number): Promise<MigrationResult[]> {
    const currentVersion = await this.getCurrentVersion();
    const results: MigrationResult[] = [];

    if (targetVersion === currentVersion) {
      console.log(`Already at version ${targetVersion}`);
      return results;
    }

    if (targetVersion > currentVersion) {
      // Migrate up
      const migrationsToRun = MIGRATIONS
        .filter(m => m.version > currentVersion && m.version <= targetVersion)
        .sort((a, b) => a.version - b.version);

      for (const migration of migrationsToRun) {
        const result = await this.runMigrationUp(migration);
        results.push(result);
        
        if (!result.success) {
          break;
        }
      }
    } else {
      // Migrate down
      const migrationsToRollback = MIGRATIONS
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version); // Reverse order for rollback

      for (const migration of migrationsToRollback) {
        const result = await this.runMigrationDown(migration);
        results.push(result);
        
        if (!result.success) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Reset database by rolling back all migrations
   */
  async reset(): Promise<MigrationResult[]> {
    return await this.migrateTo(0);
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for duplicate versions
    const versions = MIGRATIONS.map(m => m.version);
    const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate migration versions: ${duplicates.join(', ')}`);
    }

    // Check for gaps in version numbers
    const sortedVersions = [...new Set(versions)].sort((a, b) => a - b);
    for (let i = 1; i < sortedVersions.length; i++) {
      const current = sortedVersions[i];
      const previous = sortedVersions[i - 1];
      if (current !== undefined && previous !== undefined && current !== previous + 1) {
        errors.push(`Gap in migration versions between ${previous} and ${current}`);
      }
    }

    // Check migration structure
    for (const migration of MIGRATIONS) {
      if (!migration.version || !migration.name || !migration.up || !migration.down) {
        errors.push(`Migration ${migration.version} is missing required properties`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<MigrationResult[]> {
  return await withTransaction(async (connection) => {
    const runner = new MigrationRunner(connection);
    return await runner.migrateUp();
  });
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const connection = await getConnection();
  try {
    const runner = new MigrationRunner(connection);
    return await runner.getStatus();
  } finally {
    await connection.close();
  }
}

/**
 * Migrate to a specific version
 */
export async function migrateTo(targetVersion: number): Promise<MigrationResult[]> {
  return await withTransaction(async (connection) => {
    const runner = new MigrationRunner(connection);
    return await runner.migrateTo(targetVersion);
  });
}

/**
 * Reset database (rollback all migrations)
 */
export async function resetDatabase(): Promise<MigrationResult[]> {
  return await withTransaction(async (connection) => {
    const runner = new MigrationRunner(connection);
    return await runner.reset();
  });
}

/**
 * Validate migration integrity
 */
export async function validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
  const connection = await getConnection();
  try {
    const runner = new MigrationRunner(connection);
    return await runner.validateMigrations();
  } finally {
    await connection.close();
  }
}

/**
 * Initialize database with migrations on startup
 */
export async function initializeSchema(): Promise<void> {
  console.log('Initializing database schema...');
  
  try {
    // Validate migrations first
    const validation = await validateMigrations();
    if (!validation.valid) {
      throw new Error(`Migration validation failed:\n${validation.errors.join('\n')}`);
    }

    // Run pending migrations
    const results = await runMigrations();
    
    const failedMigrations = results.filter(r => !r.success);
    if (failedMigrations.length > 0) {
      const errors = failedMigrations.map(r => `${r.version}: ${r.error}`).join('\n');
      throw new Error(`Migration failures:\n${errors}`);
    }

    const status = await getMigrationStatus();
    console.log(`Database schema initialized successfully. Current version: ${status.currentVersion}`);
    
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}
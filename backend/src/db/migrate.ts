#!/usr/bin/env ts-node

// Simple migration runner script
import { initializeDatabase } from './connection';
import { runMigrations } from './migrator';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');

    // Initialize database connection
    const dbPath = path.join(process.cwd(), 'database', 'fishbowl.db');
    await initializeDatabase({ filename: dbPath });

    // Run migrations
    const results = await runMigrations();

    console.log('✅ Migration completed successfully!');
    for (const result of results) {
      if (result.success) {
        console.log(
          `  ✓ Applied migration ${result.version}: ${result.name} (${result.executionTime}ms)`
        );
      } else {
        console.error(
          `  ✗ Failed migration ${result.version}: ${result.name} - ${result.error}`
        );
      }
    }

    if (results.length === 0) {
      console.log('  ℹ️  No pending migrations to run');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

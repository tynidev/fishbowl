// Migration index file for easy importing
// Exports all available migrations in order

import migration_001 from './001_initial';
import type { Migration } from './001_initial';

export { Migration };

// All migrations in order
export const MIGRATIONS: Migration[] = [
  migration_001
];

// Get migration by version
export function getMigrationByVersion(version: number): Migration | undefined {
  return MIGRATIONS.find(m => m.version === version);
}

// Get the latest migration version
export function getLatestMigrationVersion(): number {
  return Math.max(...MIGRATIONS.map(m => m.version));
}

// Export individual migrations
export { migration_001 };
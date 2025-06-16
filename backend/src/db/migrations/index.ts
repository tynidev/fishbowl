// Migration index file for easy importing
// Exports all available migrations in order

import migration_001 from './001_initial';
import migration_002 from './002_device_sessions';
import migration_003 from './003_update_turns_table';
import migration_004 from './004_update_game_status_schema';
import migration_005 from './005_add_turn_order';
import type { Migration } from './001_initial';

export { Migration };

// All migrations in order
export const MIGRATIONS: Migration[] = [
  migration_001,
  migration_002,
  migration_003,
  migration_004,
  migration_005,
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
export {
  migration_001,
  migration_002,
  migration_003,
  migration_004,
  migration_005,
};

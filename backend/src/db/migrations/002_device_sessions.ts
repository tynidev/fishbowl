// Device sessions migration for Fishbowl game application
// Migration: 002 - Add device sessions table for reconnection handling

import { CREATE_DEVICE_SESSIONS_TABLE } from '../schema';
import type { Migration } from './001_initial';

export const migration_002: Migration = {
  version: 2,
  name: 'device_sessions',

  up: async (db: any): Promise<void> => {
    console.log('Running migration 002: Adding device sessions table...');

    try {
      // Enable foreign key constraints
      await db.exec('PRAGMA foreign_keys = ON;');

      // Create device_sessions table
      await db.exec(CREATE_DEVICE_SESSIONS_TABLE);

      // Create indexes for device_sessions table
      const deviceSessionIndexes = [
        `CREATE INDEX IF NOT EXISTS idx_device_sessions_device ON device_sessions(device_id);`,
        `CREATE INDEX IF NOT EXISTS idx_device_sessions_socket ON device_sessions(socket_id);`,
        `CREATE INDEX IF NOT EXISTS idx_device_sessions_player ON device_sessions(player_id);`,
        `CREATE INDEX IF NOT EXISTS idx_device_sessions_game ON device_sessions(game_id);`,
        `CREATE INDEX IF NOT EXISTS idx_device_sessions_active ON device_sessions(is_active);`,
        `CREATE INDEX IF NOT EXISTS idx_device_sessions_last_seen ON device_sessions(last_seen);`,
        `CREATE INDEX IF NOT EXISTS idx_device_sessions_device_game ON device_sessions(device_id, game_id);`,
      ];

      for (const indexSQL of deviceSessionIndexes) {
        await db.exec(indexSQL);
      }

      // Create trigger for automatic timestamp updates
      await db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_device_sessions_timestamp 
        AFTER UPDATE ON device_sessions 
        BEGIN 
          UPDATE device_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
        END;
      `);

      console.log('Migration 002 completed successfully');
    } catch (error) {
      console.error('Migration 002 failed:', error);
      throw error;
    }
  },

  down: async (db: any): Promise<void> => {
    console.log('Rolling back migration 002...');

    try {
      // Drop the device_sessions table
      await db.exec('DROP TABLE IF EXISTS device_sessions;');

      console.log('Migration 002 rollback completed');
    } catch (error) {
      console.error('Migration 002 rollback failed:', error);
      throw error;
    }
  },
};

// Export for migration runner
export default migration_002;

/**
 * Validate device sessions table exists and has correct structure
 */
export async function validateDeviceSessionsTable(db: any): Promise<boolean> {
  try {
    // Check if device_sessions table exists
    const result = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='device_sessions'
    `);

    if (!result) {
      console.error('Device sessions table not found');
      return false;
    }

    // Check table structure
    const columns = await db.all('PRAGMA table_info(device_sessions)');
    const expectedColumns = [
      'id',
      'device_id',
      'socket_id',
      'player_id',
      'game_id',
      'last_seen',
      'is_active',
      'created_at',
      'updated_at',
    ];

    const actualColumns = columns.map((col: any) => col.name);

    for (const expectedCol of expectedColumns) {
      if (!actualColumns.includes(expectedCol)) {
        console.error(
          `Missing column '${expectedCol}' in device_sessions table`
        );
        return false;
      }
    }

    console.log('Device sessions table validation passed');
    return true;
  } catch (error) {
    console.error('Device sessions table validation failed:', error);
    return false;
  }
}

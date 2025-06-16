// Main database module exports
// Centralizes all database-related exports for easy importing

// Export all schema types and SQL definitions
export * from './schema';

// Export all migrations
export * from './migrations';

// Export database connection and management
export * from './connection';

// Export migration runner
export * from './migrator';

// Export database utilities
export * from './utils';

// Export database initialization
export * from './init';

// Re-export commonly used types for convenience
export type { Game, Phrase, Player, Team, Turn, TurnPhrase } from './schema';

export type { Migration } from './migrations';

export type { DatabaseConfig, DatabaseConnection, TransactionConnection } from './connection';

export type { MigrationRecord, MigrationResult, MigrationStatus } from './migrator';

export type { QueryOptions, WhereCondition } from './utils';

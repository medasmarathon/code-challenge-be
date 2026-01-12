/**
 * Database Connection - Infrastructure Layer
 * 
 * Creates and configures the database connection using Kysely and better-sqlite3.
 */

import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { DatabaseSchema, DatabaseInstance } from './types';

/**
 * Factory function to create a new database instance
 * Enables dependency injection and testing with different database paths
 * @param dbPath - Path to SQLite database file (default: 'local.db')
 * @returns Kysely database instance
 */
export function createDatabase(dbPath: string = 'local.db'): DatabaseInstance {
  const dialect = new SqliteDialect({
    database: new Database(dbPath),
  });

  return new Kysely<DatabaseSchema>({
    dialect,
  });
}

/**
 * Default database instance for production use
 * Use createDatabase() for testing with custom database paths
 */
export const db = createDatabase();

import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Database as DatabaseType } from '../models/types';
import { DatabaseInstance } from '../models/interfaces';

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

  return new Kysely<DatabaseType>({
    dialect,
  });
}

/**
 * Default database instance for production use
 * Use createDatabase() for testing with custom database paths
 */
export const db = createDatabase();

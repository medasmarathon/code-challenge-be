/**
 * Migration Runner - Infrastructure Layer
 * 
 * Handles database migrations using Kysely's built-in Migrator.
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider } from 'kysely';
import { db } from './db';

/**
 * Run all pending migrations using Kysely's built-in Migrator
 */
export async function runMigrations(): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // Absolute path to migrations folder
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Failed to migrate');
    console.error(error);
    throw error;
  }

  if (!results?.length) {
    console.log('No pending migrations.');
  }
}

/**
 * Rollback the last migration
 */
export async function rollbackLastMigration(): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" was rolled back successfully`);
    } else if (it.status === 'Error') {
      console.error(`Failed to rollback migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Failed to rollback');
    console.error(error);
    throw error;
  }

  if (!results?.length) {
    console.log('No migrations to rollback.');
  }
}

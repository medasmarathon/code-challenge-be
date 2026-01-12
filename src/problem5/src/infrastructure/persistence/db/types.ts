/**
 * Database Types - Infrastructure Layer
 * 
 * Kysely-specific types for database tables.
 */

import { Generated, Kysely } from 'kysely';

/**
 * Resource table schema for Kysely
 */
export interface ResourceTable {
  id: Generated<number>;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database schema definition
 */
export interface DatabaseSchema {
  resources: ResourceTable;
}

/**
 * Type alias for the Kysely database instance
 */
export type DatabaseInstance = Kysely<DatabaseSchema>;

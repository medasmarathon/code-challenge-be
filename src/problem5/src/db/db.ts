import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Database as DatabaseType } from '../models/types';

const dialect = new SqliteDialect({
  database: new Database('local.db'),
});

export const db = new Kysely<DatabaseType>({
  dialect,
});

import * as fs from 'fs';
import * as path from 'path';

const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: ts-node migrate-create.ts <migration-name>');
  console.error('Example: ts-node migrate-create.ts add_users_table');
  process.exit(1);
}

// Generate ISO date prefix
const now = new Date();
const datePrefix = now.toISOString().split('T')[0]; // YYYY-MM-DD

// Sanitize migration name (replace spaces with underscores, lowercase)
const sanitizedName = migrationName
  .toLowerCase()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '');

const fileName = `${datePrefix}_${sanitizedName}.ts`;
const migrationsDir = path.join(__dirname, '..', 'migrations');
const filePath = path.join(migrationsDir, fileName);

// Ensure migrations directory exists
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Check if file already exists
if (fs.existsSync(filePath)) {
  console.error(`Migration file already exists: ${fileName}`);
  process.exit(1);
}

const template = `import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Write your migration here
  // Example:
  // await db.schema
  //   .createTable('table_name')
  //   .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
  //   .addColumn('name', 'text', (col) => col.notNull())
  //   .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Write your rollback here
  // Example:
  // await db.schema.dropTable('table_name').ifExists().execute();
}
`;

fs.writeFileSync(filePath, template);
console.log(`Created migration: ${fileName}`);
console.log(`Path: ${filePath}`);


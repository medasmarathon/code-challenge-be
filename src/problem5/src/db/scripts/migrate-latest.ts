import { runMigrations } from '../migrationRunner';

runMigrations()
  .then(() => {
    console.log('Migration to latest completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

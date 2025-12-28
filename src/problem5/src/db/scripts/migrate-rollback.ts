import { rollbackLastMigration } from '../migrationRunner';

rollbackLastMigration()
  .then(() => {
    console.log('Rollback completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Rollback failed:', error);
    process.exit(1);
  });

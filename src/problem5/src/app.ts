import express from 'express';
import resourceRoutes from './routes/resourceRoutes';
import { runMigrations } from './db/migrationRunner';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API versioning - RESTful convention
app.use('/api/v1/resources', resourceRoutes);

app.use(errorHandler);

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

export default app;

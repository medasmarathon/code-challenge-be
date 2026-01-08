import express from 'express';
import { createResourceRoutes } from './routes/resourceRoutes';
import { createContainer } from './di/container';
import { runMigrations } from './db/migrationRunner';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Create dependency container with all wired dependencies
const container = createContainer();

// API versioning - RESTful convention
// Routes are created with injected controller from the container
app.use('/api/v1/resources', createResourceRoutes(container.controller));

app.use(errorHandler);

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

export default app;

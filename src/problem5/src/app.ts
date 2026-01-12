import express from 'express';
import { createResourceRoutes } from './routes/resourceRoutes';
import { createContainer } from './di/container';
import { runMigrations } from './db/migrationRunner';
import { errorHandler } from './middleware/errorHandler';

const /**
 * Application Entry Point - Composition Root
 * 
 * This is where all dependencies are wired together following Clean Architecture.
 * The composition root is the only place that knows about all layers.
 */

import express from 'express';
import { createResourceRoutes } from './infrastructure/http/routes/resourceRoutes';
import { createContainer } from './infrastructure/di/container';
import { runMigrations } from './infrastructure/persistence/db/migrationRunner';
import { errorHandler } from './infrastructure/http/middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Create dependency container with all wired dependencies
// This is the composition root - the only place that knows about all layers
const container = createContainer();

// API versioning - RESTful convention
// Routes are created with injected controller from the container
app.use('/api/v1/resources', createResourceRoutes(container.controller));

// Global error handler
app.use(errorHandler);

// Initialize database and start server
runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

export default app;;
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

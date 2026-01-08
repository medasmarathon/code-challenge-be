import { db, createDatabase } from '../db/db';
import { ResourceRepository } from '../repositories/resourceRepository';
import { ResourceService } from '../services/resourceService';
import { ResourceController } from '../controllers/resourceController';
import { DatabaseInstance, IResourceRepository, IResourceService } from '../models/interfaces';

/**
 * Dependency Injection Container
 * 
 * Provides factory functions for creating application components with proper dependency injection.
 * This enables:
 * - Easy mocking for unit tests
 * - Flexible database configuration
 * - Clean separation of concerns
 * 
 * Usage in production:
 *   const { controller } = createContainer();
 * 
 * Usage in tests:
 *   const mockRepo = createMockRepository();
 *   const { service } = createContainer({ repository: mockRepo });
 */

export interface ContainerOptions {
  database?: DatabaseInstance;
  repository?: IResourceRepository;
  service?: IResourceService;
}

export interface Container {
  database: DatabaseInstance;
  repository: IResourceRepository;
  service: IResourceService;
  controller: ResourceController;
}

/**
 * Creates a fully wired container with all dependencies
 * @param options - Optional overrides for dependencies (useful for testing)
 * @returns Container with all application components
 */
export function createContainer(options: ContainerOptions = {}): Container {
  const database = options.database ?? db;
  const repository = options.repository ?? new ResourceRepository(database);
  const service = options.service ?? new ResourceService(repository);
  const controller = new ResourceController(service);

  return {
    database,
    repository,
    service,
    controller,
  };
}

/**
 * Creates a repository with optional database override
 * @param database - Optional database instance (defaults to production db)
 * @returns ResourceRepository instance
 */
export function createResourceRepository(database?: DatabaseInstance): IResourceRepository {
  return new ResourceRepository(database ?? db);
}

/**
 * Creates a service with optional repository override
 * @param repository - Optional repository instance (for mocking in tests)
 * @returns ResourceService instance
 */
export function createResourceService(repository?: IResourceRepository): IResourceService {
  return new ResourceService(repository ?? createResourceRepository());
}

/**
 * Creates a controller with optional service override
 * @param service - Optional service instance (for mocking in tests)
 * @returns ResourceController instance
 */
export function createResourceController(service?: IResourceService): ResourceController {
  return new ResourceController(service ?? createResourceService());
}

/**
 * Creates a test container with an in-memory or test database
 * @param dbPath - Path to test database (e.g., ':memory:' for SQLite in-memory)
 * @returns Container configured for testing
 */
export function createTestContainer(dbPath: string = ':memory:'): Container {
  const database = createDatabase(dbPath);
  return createContainer({ database });
}

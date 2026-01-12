/**
 * Dependency Injection Container - Infrastructure Layer
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
 *   const { useCases } = createContainer({ repository: mockRepo });
 */

import { db, createDatabase, DatabaseInstance } from '../persistence/db';
import { SqliteResourceRepository } from '../persistence/repositories/SqliteResourceRepository';
import { ResourceController, ResourceUseCases } from '../http/controllers/ResourceController';
import { IResourceRepository } from '../../domain/repositories/IResourceRepository';
import {
  CreateResourceUseCase,
  GetResourceUseCase,
  ListResourcesUseCase,
  UpdateResourceUseCase,
  PartialUpdateResourceUseCase,
  DeleteResourceUseCase,
  ICreateResourceUseCase,
  IGetResourceUseCase,
  IListResourcesUseCase,
  IUpdateResourceUseCase,
  IPartialUpdateResourceUseCase,
  IDeleteResourceUseCase,
} from '../../application/use-cases';

/**
 * All use case interfaces for the container
 */
export interface UseCases {
  createResource: ICreateResourceUseCase;
  getResource: IGetResourceUseCase;
  listResources: IListResourcesUseCase;
  updateResource: IUpdateResourceUseCase;
  partialUpdateResource: IPartialUpdateResourceUseCase;
  deleteResource: IDeleteResourceUseCase;
}

/**
 * Container options for dependency injection
 */
export interface ContainerOptions {
  database?: DatabaseInstance;
  repository?: IResourceRepository;
  useCases?: Partial<UseCases>;
}

/**
 * Dependency injection container
 */
export interface Container {
  database: DatabaseInstance;
  repository: IResourceRepository;
  useCases: UseCases;
  controller: ResourceController;
}

/**
 * Creates all use cases with the given repository
 */
function createUseCases(repository: IResourceRepository): UseCases {
  return {
    createResource: new CreateResourceUseCase(repository),
    getResource: new GetResourceUseCase(repository),
    listResources: new ListResourcesUseCase(repository),
    updateResource: new UpdateResourceUseCase(repository),
    partialUpdateResource: new PartialUpdateResourceUseCase(repository),
    deleteResource: new DeleteResourceUseCase(repository),
  };
}

/**
 * Creates a fully wired container with all dependencies
 * @param options - Optional overrides for dependencies (useful for testing)
 * @returns Container with all application components
 */
export function createContainer(options: ContainerOptions = {}): Container {
  const database = options.database ?? db;
  const repository = options.repository ?? new SqliteResourceRepository(database);
  
  // Create use cases, allowing individual overrides
  const defaultUseCases = createUseCases(repository);
  const useCases: UseCases = {
    ...defaultUseCases,
    ...options.useCases,
  };
  
  const controller = new ResourceController(useCases);

  return {
    database,
    repository,
    useCases,
    controller,
  };
}

/**
 * Creates a repository with optional database override
 * @param database - Optional database instance (defaults to production db)
 * @returns SqliteResourceRepository instance
 */
export function createResourceRepository(database?: DatabaseInstance): IResourceRepository {
  return new SqliteResourceRepository(database ?? db);
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

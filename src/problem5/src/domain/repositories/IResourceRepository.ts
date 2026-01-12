/**
 * Resource Repository Interface - Domain Layer (Port)
 * 
 * This is the repository port/interface defined in the domain layer.
 * It defines the contract for data access without knowing about
 * the actual implementation (SQLite, PostgreSQL, in-memory, etc.).
 * 
 * The implementation will be in the infrastructure layer.
 */

import { Resource, CreateResourceProps, UpdateResourceProps, PartialUpdateResourceProps } from '../entities/Resource';

/**
 * Sort order for listing operations
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Valid fields for sorting resources
 */
export type SortField = 'id' | 'name' | 'createdAt' | 'updatedAt';

/**
 * Options for listing resources with filtering and pagination
 */
export interface ListResourcesOptions {
  name?: string;
  description?: string;
  limit: number;
  offset: number;
  sort: SortField;
  order: SortOrder;
}

/**
 * Result of a paginated list operation
 */
export interface ListResourcesResult {
  data: Resource[];
  total: number;
}

/**
 * Repository interface for Resource persistence
 * 
 * Following the Repository Pattern and Dependency Inversion Principle:
 * - Domain defines the interface (port)
 * - Infrastructure provides the implementation (adapter)
 */
export interface IResourceRepository {
  /**
   * Create a new resource
   * @param data - Resource creation data
   * @returns The created resource
   */
  create(data: CreateResourceProps): Promise<Resource>;

  /**
   * Find all resources with filtering and pagination
   * @param options - List options including filters and pagination
   * @returns Paginated list of resources with total count
   */
  findAll(options: ListResourcesOptions): Promise<ListResourcesResult>;

  /**
   * Find a resource by its ID
   * @param id - Resource ID
   * @returns The resource if found, undefined otherwise
   */
  findById(id: number): Promise<Resource | undefined>;

  /**
   * Find a resource by its name
   * @param name - Resource name
   * @returns The resource if found, undefined otherwise
   */
  findByName(name: string): Promise<Resource | undefined>;

  /**
   * Update a resource completely
   * @param id - Resource ID
   * @param data - Full update data
   * @returns The updated resource if found, undefined otherwise
   */
  update(id: number, data: UpdateResourceProps): Promise<Resource | undefined>;

  /**
   * Partially update a resource
   * @param id - Resource ID
   * @param data - Partial update data
   * @returns The updated resource if found, undefined otherwise
   */
  partialUpdate(id: number, data: PartialUpdateResourceProps): Promise<Resource | undefined>;

  /**
   * Delete a resource
   * @param id - Resource ID
   * @returns true if deleted, false if not found
   */
  delete(id: number): Promise<boolean>;
}

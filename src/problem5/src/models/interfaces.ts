import { Kysely } from 'kysely';
import { Resource, Database as DatabaseType } from './types';
import { SortOrderType } from '../utils/constants';

/**
 * Filter and pagination options for listing resources
 */
export interface ListResourcesOptions {
  name?: string;
  description?: string;
  limit: number;
  offset: number;
  sort: string;
  order: SortOrderType;
}

/**
 * Result of listing resources with pagination metadata
 */
export interface ListResourcesResult {
  data: Resource[];
  total: number;
}

/**
 * Data required to create a new resource
 */
export interface CreateResourceData {
  name: string;
  description: string | null;
}

/**
 * Data for full resource update
 */
export interface UpdateResourceData {
  name: string;
  description: string | null;
}

/**
 * Data for partial resource update
 */
export interface PartialUpdateResourceData {
  name?: string;
  description?: string | null;
}

/**
 * Repository interface for Resource data access
 * Following Interface Segregation and Dependency Inversion principles
 */
export interface IResourceRepository {
  create(data: CreateResourceData): Promise<Resource>;
  findAll(options: ListResourcesOptions): Promise<ListResourcesResult>;
  findById(id: number): Promise<Resource | undefined>;
  findByName(name: string): Promise<Resource | undefined>;
  update(id: number, data: UpdateResourceData): Promise<Resource | undefined>;
  partialUpdate(id: number, data: PartialUpdateResourceData): Promise<Resource | undefined>;
  delete(id: number): Promise<boolean>;
}

/**
 * Service interface for Resource business logic
 * Following Interface Segregation and Dependency Inversion principles
 */
export interface IResourceService {
  createResource(data: CreateResourceData): Promise<Resource>;
  listResources(options: ListResourcesOptions): Promise<ListResourcesResult>;
  getResource(id: number): Promise<Resource | undefined>;
  findByName(name: string): Promise<Resource | undefined>;
  updateResource(id: number, data: UpdateResourceData): Promise<Resource | undefined>;
  partialUpdateResource(id: number, data: PartialUpdateResourceData): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<boolean>;
}

/**
 * Type alias for the Kysely database instance
 * Enables dependency injection of database connection
 */
export type DatabaseInstance = Kysely<DatabaseType>;

/**
 * SQLite Resource Repository - Infrastructure Layer
 * 
 * Implements the IResourceRepository port defined in the domain layer.
 * Uses Kysely as the query builder for type-safe SQL operations.
 */

import { Resource, CreateResourceProps, UpdateResourceProps, PartialUpdateResourceProps } from '../../../domain/entities/Resource';
import { IResourceRepository, ListResourcesOptions, ListResourcesResult } from '../../../domain/repositories/IResourceRepository';
import { DatabaseInstance } from '../db/types';
import { ResourcePersistenceMapper } from '../mappers/ResourcePersistenceMapper';

/**
 * SQLite implementation of IResourceRepository
 */
export class SqliteResourceRepository implements IResourceRepository {
  constructor(private readonly db: DatabaseInstance) {}

  async create(data: CreateResourceProps): Promise<Resource> {
    const now = new Date().toISOString();
    const record = await this.db.insertInto('resources')
      .values({
        name: data.name,
        description: data.description,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return ResourcePersistenceMapper.toDomain(record);
  }

  async findAll(options: ListResourcesOptions): Promise<ListResourcesResult> {
    // Build base query for filtering
    let baseQuery = this.db.selectFrom('resources');
    
    if (options.name) {
      baseQuery = baseQuery.where('name', 'like', `%${options.name}%`);
    }
    if (options.description) {
      baseQuery = baseQuery.where('description', 'like', `%${options.description}%`);
    }

    // Get total count for pagination metadata
    const countResult = await baseQuery
      .select(this.db.fn.count('id').as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // Get paginated and sorted data
    const sortColumn = options.sort as 'id' | 'name' | 'createdAt' | 'updatedAt';
    const records = await baseQuery
      .selectAll()
      .orderBy(sortColumn, options.order)
      .limit(options.limit)
      .offset(options.offset)
      .execute();

    return {
      data: ResourcePersistenceMapper.toDomainList(records),
      total
    };
  }

  async findById(id: number): Promise<Resource | undefined> {
    const record = await this.db.selectFrom('resources')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return record ? ResourcePersistenceMapper.toDomain(record) : undefined;
  }

  async findByName(name: string): Promise<Resource | undefined> {
    const record = await this.db.selectFrom('resources')
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst();

    return record ? ResourcePersistenceMapper.toDomain(record) : undefined;
  }

  async update(id: number, data: UpdateResourceProps): Promise<Resource | undefined> {
    const now = new Date().toISOString();
    const record = await this.db.updateTable('resources')
      .set({ 
        name: data.name,
        description: data.description,
        updatedAt: now 
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
      
    return record ? ResourcePersistenceMapper.toDomain(record) : undefined;
  }

  async partialUpdate(id: number, data: PartialUpdateResourceProps): Promise<Resource | undefined> {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };
    
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    
    const record = await this.db.updateTable('resources')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
      
    return record ? ResourcePersistenceMapper.toDomain(record) : undefined;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom('resources')
      .where('id', '=', id)
      .executeTakeFirst();
      
    return Number(result.numDeletedRows) > 0;
  }
}

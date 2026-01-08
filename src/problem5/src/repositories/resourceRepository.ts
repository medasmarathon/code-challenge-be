import { Resource } from '../models/types';
import { 
  IResourceRepository, 
  DatabaseInstance, 
  ListResourcesOptions, 
  ListResourcesResult, 
  CreateResourceData, 
  UpdateResourceData, 
  PartialUpdateResourceData 
} from '../models/interfaces';

/**
 * Repository for Resource data access
 * Implements IResourceRepository for dependency injection and testing
 */
export class ResourceRepository implements IResourceRepository {
  private db: DatabaseInstance;

  /**
   * @param db - Kysely database instance (injected for testability)
   */
  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  async create(resource: CreateResourceData): Promise<Resource> {
    const now = new Date().toISOString();
    return await this.db.insertInto('resources')
      .values({
        name: resource.name,
        description: resource.description,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();
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
    const data = await baseQuery
      .selectAll()
      .orderBy(sortColumn, options.order)
      .limit(options.limit)
      .offset(options.offset)
      .execute();

    return { data, total };
  }

  async findById(id: number): Promise<Resource | undefined> {
    return await this.db.selectFrom('resources')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findByName(name: string): Promise<Resource | undefined> {
    return await this.db.selectFrom('resources')
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst();
  }

  async update(id: number, resource: UpdateResourceData): Promise<Resource | undefined> {
    const now = new Date().toISOString();
    const result = await this.db.updateTable('resources')
      .set({ 
        name: resource.name,
        description: resource.description,
        updatedAt: now 
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
      
    return result;
  }

  async partialUpdate(id: number, resource: PartialUpdateResourceData): Promise<Resource | undefined> {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };
    
    if (resource.name !== undefined) {
      updateData.name = resource.name;
    }
    if (resource.description !== undefined) {
      updateData.description = resource.description;
    }
    
    const result = await this.db.updateTable('resources')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
      
    return result;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom('resources')
      .where('id', '=', id)
      .executeTakeFirst();
      
    return Number(result.numDeletedRows) > 0;
  }
}

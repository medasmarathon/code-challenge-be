import { db } from '../db/db';
import { Resource } from '../models/types';

export class ResourceRepository {
  async create(resource: { name: string; description: string | null }): Promise<Resource> {
    const now = new Date().toISOString();
    return await db.insertInto('resources')
      .values({
        name: resource.name,
        description: resource.description,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findAll(filters: { 
    name?: string; 
    description?: string;
    limit: number;
    offset: number;
    sort: string;
    order: 'asc' | 'desc';
  }): Promise<{ data: Resource[]; total: number }> {
    // Build base query for filtering
    let baseQuery = db.selectFrom('resources');
    
    if (filters.name) {
      baseQuery = baseQuery.where('name', 'like', `%${filters.name}%`);
    }
    if (filters.description) {
      baseQuery = baseQuery.where('description', 'like', `%${filters.description}%`);
    }

    // Get total count for pagination metadata
    const countResult = await baseQuery
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // Get paginated and sorted data
    const sortColumn = filters.sort as 'id' | 'name' | 'createdAt' | 'updatedAt';
    const data = await baseQuery
      .selectAll()
      .orderBy(sortColumn, filters.order)
      .limit(filters.limit)
      .offset(filters.offset)
      .execute();

    return { data, total };
  }

  async findById(id: number): Promise<Resource | undefined> {
    return await db.selectFrom('resources')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findByName(name: string): Promise<Resource | undefined> {
    return await db.selectFrom('resources')
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst();
  }

  async update(id: number, resource: { name: string; description: string | null }): Promise<Resource | undefined> {
    const now = new Date().toISOString();
    const result = await db.updateTable('resources')
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

  async partialUpdate(id: number, resource: Partial<{ name: string; description: string | null }>): Promise<Resource | undefined> {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };
    
    if (resource.name !== undefined) {
      updateData.name = resource.name;
    }
    if (resource.description !== undefined) {
      updateData.description = resource.description;
    }
    
    const result = await db.updateTable('resources')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
      
    return result;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db.deleteFrom('resources')
      .where('id', '=', id)
      .executeTakeFirst();
      
    return Number(result.numDeletedRows) > 0;
  }
}

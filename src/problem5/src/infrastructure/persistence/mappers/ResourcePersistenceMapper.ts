/**
 * Resource Persistence Mapper - Infrastructure Layer
 * 
 * Maps between database records and domain entities.
 * This is different from the application layer mapper which handles DTOs.
 */

import { Resource, ResourceProps } from '../../../domain/entities/Resource';

/**
 * Raw database record type
 */
export interface ResourceRecord {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ResourcePersistenceMapper {
  /**
   * Map a database record to a domain entity
   */
  static toDomain(record: ResourceRecord): Resource {
    const props: ResourceProps = {
      id: record.id,
      name: record.name,
      description: record.description,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };

    return Resource.reconstitute(props);
  }

  /**
   * Map multiple database records to domain entities
   */
  static toDomainList(records: ResourceRecord[]): Resource[] {
    return records.map(record => ResourcePersistenceMapper.toDomain(record));
  }

  /**
   * Map a domain entity to a database record (for persistence)
   */
  static toPersistence(entity: Resource): ResourceRecord {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

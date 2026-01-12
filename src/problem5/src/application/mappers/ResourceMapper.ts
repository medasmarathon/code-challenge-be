/**
 * Resource Mapper - Application Layer
 * 
 * Maps between domain entities and DTOs.
 * This keeps the domain layer clean and independent.
 */

import { Resource } from '../../domain/entities/Resource';
import { ResourceResponseDTO } from '../dtos/ResourceResponseDTO';

export class ResourceMapper {
  /**
   * Map a Resource entity to a response DTO
   */
  static toResponseDTO(resource: Resource): ResourceResponseDTO {
    return {
      id: resource.id,
      name: resource.name,
      description: resource.description,
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    };
  }

  /**
   * Map multiple Resource entities to response DTOs
   */
  static toResponseDTOList(resources: Resource[]): ResourceResponseDTO[] {
    return resources.map(resource => ResourceMapper.toResponseDTO(resource));
  }
}

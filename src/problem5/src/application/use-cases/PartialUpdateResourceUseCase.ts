/**
 * Partial Update Resource Use Case - Application Layer
 * 
 * Handles the business logic for partially updating a resource (PATCH).
 */

import { IResourceRepository } from '../../domain/repositories/IResourceRepository';
import { EntityNotFoundError, EntityConflictError } from '../../domain/errors/DomainError';
import { PartialUpdateResourceDTO } from '../dtos/UpdateResourceDTO';
import { ResourceResponseDTO } from '../dtos/ResourceResponseDTO';
import { ResourceMapper } from '../mappers/ResourceMapper';

/**
 * Input port interface for Partial Update Resource use case
 */
export interface IPartialUpdateResourceUseCase {
  execute(id: number, data: PartialUpdateResourceDTO): Promise<ResourceResponseDTO>;
}

/**
 * Partial Update Resource Use Case Implementation
 */
export class PartialUpdateResourceUseCase implements IPartialUpdateResourceUseCase {
  constructor(private readonly resourceRepository: IResourceRepository) {}

  async execute(id: number, data: PartialUpdateResourceDTO): Promise<ResourceResponseDTO> {
    // Check if resource exists
    const existingResource = await this.resourceRepository.findById(id);
    if (!existingResource) {
      throw new EntityNotFoundError('Resource', id);
    }

    // Check for name conflict if name is being updated
    if (data.name !== undefined && data.name !== existingResource.name) {
      const resourceWithSameName = await this.resourceRepository.findByName(data.name);
      if (resourceWithSameName && resourceWithSameName.id !== id) {
        throw new EntityConflictError('Resource', 'name', data.name);
      }
    }

    // Partial update the resource
    const updatedResource = await this.resourceRepository.partialUpdate(id, {
      name: data.name,
      description: data.description,
    });

    if (!updatedResource) {
      throw new EntityNotFoundError('Resource', id);
    }

    return ResourceMapper.toResponseDTO(updatedResource);
  }
}

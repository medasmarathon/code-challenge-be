/**
 * Update Resource Use Case - Application Layer
 * 
 * Handles the business logic for fully updating a resource.
 */

import { IResourceRepository } from '../../domain/repositories/IResourceRepository';
import { EntityNotFoundError, EntityConflictError } from '../../domain/errors/DomainError';
import { UpdateResourceDTO } from '../dtos/UpdateResourceDTO';
import { ResourceResponseDTO } from '../dtos/ResourceResponseDTO';
import { ResourceMapper } from '../mappers/ResourceMapper';

/**
 * Input port interface for Update Resource use case
 */
export interface IUpdateResourceUseCase {
  execute(id: number, data: UpdateResourceDTO): Promise<ResourceResponseDTO>;
}

/**
 * Update Resource Use Case Implementation
 */
export class UpdateResourceUseCase implements IUpdateResourceUseCase {
  constructor(private readonly resourceRepository: IResourceRepository) {}

  async execute(id: number, data: UpdateResourceDTO): Promise<ResourceResponseDTO> {
    // Check if resource exists
    const existingResource = await this.resourceRepository.findById(id);
    if (!existingResource) {
      throw new EntityNotFoundError('Resource', id);
    }

    // Check for name conflict with other resources
    if (data.name !== existingResource.name) {
      const resourceWithSameName = await this.resourceRepository.findByName(data.name);
      if (resourceWithSameName && resourceWithSameName.id !== id) {
        throw new EntityConflictError('Resource', 'name', data.name);
      }
    }

    // Update the resource
    const updatedResource = await this.resourceRepository.update(id, {
      name: data.name,
      description: data.description,
    });

    if (!updatedResource) {
      throw new EntityNotFoundError('Resource', id);
    }

    return ResourceMapper.toResponseDTO(updatedResource);
  }
}

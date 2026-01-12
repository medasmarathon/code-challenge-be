/**
 * Get Resource Use Case - Application Layer
 * 
 * Handles the business logic for retrieving a single resource by ID.
 */

import { IResourceRepository } from '../../domain/repositories/IResourceRepository';
import { EntityNotFoundError } from '../../domain/errors/DomainError';
import { ResourceResponseDTO } from '../dtos/ResourceResponseDTO';
import { ResourceMapper } from '../mappers/ResourceMapper';

/**
 * Input port interface for Get Resource use case
 */
export interface IGetResourceUseCase {
  execute(id: number): Promise<ResourceResponseDTO>;
}

/**
 * Get Resource Use Case Implementation
 */
export class GetResourceUseCase implements IGetResourceUseCase {
  constructor(private readonly resourceRepository: IResourceRepository) {}

  async execute(id: number): Promise<ResourceResponseDTO> {
    const resource = await this.resourceRepository.findById(id);
    
    if (!resource) {
      throw new EntityNotFoundError('Resource', id);
    }

    return ResourceMapper.toResponseDTO(resource);
  }
}

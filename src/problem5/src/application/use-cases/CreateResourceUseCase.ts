/**
 * Create Resource Use Case - Application Layer
 * 
 * Handles the business logic for creating a new resource.
 * Use cases orchestrate the flow of data and apply business rules.
 */

import { IResourceRepository } from '../../domain/repositories/IResourceRepository';
import { EntityConflictError } from '../../domain/errors/DomainError';
import { CreateResourceDTO } from '../dtos/CreateResourceDTO';
import { ResourceResponseDTO } from '../dtos/ResourceResponseDTO';
import { ResourceMapper } from '../mappers/ResourceMapper';

/**
 * Input port interface for Create Resource use case
 */
export interface ICreateResourceUseCase {
  execute(data: CreateResourceDTO): Promise<ResourceResponseDTO>;
}

/**
 * Create Resource Use Case Implementation
 */
export class CreateResourceUseCase implements ICreateResourceUseCase {
  constructor(private readonly resourceRepository: IResourceRepository) {}

  async execute(data: CreateResourceDTO): Promise<ResourceResponseDTO> {
    // Check for duplicate name
    const existingResource = await this.resourceRepository.findByName(data.name);
    if (existingResource) {
      throw new EntityConflictError('Resource', 'name', data.name);
    }

    // Create the resource
    const resource = await this.resourceRepository.create({
      name: data.name,
      description: data.description,
    });

    return ResourceMapper.toResponseDTO(resource);
  }
}

/**
 * Delete Resource Use Case - Application Layer
 * 
 * Handles the business logic for deleting a resource.
 */

import { IResourceRepository } from '../../domain/repositories/IResourceRepository';
import { EntityNotFoundError } from '../../domain/errors/DomainError';

/**
 * Input port interface for Delete Resource use case
 */
export interface IDeleteResourceUseCase {
  execute(id: number): Promise<void>;
}

/**
 * Delete Resource Use Case Implementation
 */
export class DeleteResourceUseCase implements IDeleteResourceUseCase {
  constructor(private readonly resourceRepository: IResourceRepository) {}

  async execute(id: number): Promise<void> {
    const deleted = await this.resourceRepository.delete(id);
    
    if (!deleted) {
      throw new EntityNotFoundError('Resource', id);
    }
  }
}

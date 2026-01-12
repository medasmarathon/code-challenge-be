/**
 * List Resources Use Case - Application Layer
 * 
 * Handles the business logic for listing resources with filtering and pagination.
 */

import { IResourceRepository } from '../../domain/repositories/IResourceRepository';
import { ListResourcesDTO } from '../dtos/ListResourcesDTO';
import { ListResourcesResponseDTO } from '../dtos/ResourceResponseDTO';
import { ResourceMapper } from '../mappers/ResourceMapper';

/**
 * Input port interface for List Resources use case
 */
export interface IListResourcesUseCase {
  execute(options: ListResourcesDTO): Promise<ListResourcesResponseDTO>;
}

/**
 * List Resources Use Case Implementation
 */
export class ListResourcesUseCase implements IListResourcesUseCase {
  constructor(private readonly resourceRepository: IResourceRepository) {}

  async execute(options: ListResourcesDTO): Promise<ListResourcesResponseDTO> {
    const result = await this.resourceRepository.findAll({
      name: options.name,
      description: options.description,
      limit: options.limit,
      offset: options.offset,
      sort: options.sort,
      order: options.order,
    });

    return {
      data: ResourceMapper.toResponseDTOList(result.data),
      total: result.total,
    };
  }
}

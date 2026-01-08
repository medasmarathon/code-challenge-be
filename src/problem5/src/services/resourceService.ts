import { Resource } from '../models/types';
import { 
  IResourceRepository, 
  IResourceService, 
  ListResourcesOptions, 
  ListResourcesResult, 
  CreateResourceData, 
  UpdateResourceData, 
  PartialUpdateResourceData 
} from '../models/interfaces';

/**
 * Service for Resource business logic
 * Implements IResourceService for dependency injection and testing
 */
export class ResourceService implements IResourceService {
  private repository: IResourceRepository;

  /**
   * @param repository - Resource repository instance (injected for testability)
   */
  constructor(repository: IResourceRepository) {
    this.repository = repository;
  }

  async createResource(data: CreateResourceData): Promise<Resource> {
    return this.repository.create(data);
  }

  async listResources(options: ListResourcesOptions): Promise<ListResourcesResult> {
    return this.repository.findAll(options);
  }

  async getResource(id: number): Promise<Resource | undefined> {
    return this.repository.findById(id);
  }

  async findByName(name: string): Promise<Resource | undefined> {
    return this.repository.findByName(name);
  }

  async updateResource(id: number, data: UpdateResourceData): Promise<Resource | undefined> {
    return this.repository.update(id, data);
  }

  async partialUpdateResource(id: number, data: PartialUpdateResourceData): Promise<Resource | undefined> {
    return this.repository.partialUpdate(id, data);
  }

  async deleteResource(id: number): Promise<boolean> {
    return this.repository.delete(id);
  }
}

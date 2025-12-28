import { ResourceRepository } from '../repositories/resourceRepository';
import { Resource } from '../models/types';

export class ResourceService {
  private repository: ResourceRepository;

  constructor() {
    this.repository = new ResourceRepository();
  }

  async createResource(data: { name: string; description: string | null }): Promise<Resource> {
    return this.repository.create(data);
  }

  async listResources(filters: { 
    name?: string; 
    description?: string;
    limit: number;
    offset: number;
    sort: string;
    order: 'asc' | 'desc';
  }): Promise<{ data: Resource[]; total: number }> {
    return this.repository.findAll(filters);
  }

  async getResource(id: number): Promise<Resource | undefined> {
    return this.repository.findById(id);
  }

  async findByName(name: string): Promise<Resource | undefined> {
    return this.repository.findByName(name);
  }

  async updateResource(id: number, data: { name: string; description: string | null }): Promise<Resource | undefined> {
    return this.repository.update(id, data);
  }

  async partialUpdateResource(id: number, data: Partial<{ name: string; description: string | null }>): Promise<Resource | undefined> {
    return this.repository.partialUpdate(id, data);
  }

  async deleteResource(id: number): Promise<boolean> {
    return this.repository.delete(id);
  }
}

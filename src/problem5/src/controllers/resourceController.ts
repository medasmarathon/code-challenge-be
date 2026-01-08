import { Request, Response } from 'express';
import { IResourceService } from '../models/interfaces';
import { Errors } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpStatus, ResourceFields, ResourceName, SortOrder } from '../utils/constants';
import { 
  CreateResourceInput, 
  UpdateResourceInput, 
  PartialUpdateResourceInput,
  ListResourcesQuery
} from '../schemas/resourceSchema';

/**
 * Controller for Resource HTTP endpoints
 * Handles request/response, delegates business logic to service layer
 */
export class ResourceController {
  private service: IResourceService;

  /**
   * @param service - Resource service instance (injected for testability)
   */
  constructor(service: IResourceService) {
    this.service = service;
  }

  /**
   * POST /api/v1/resources
   * Create a new resource
   * Returns: 201 Created with resource data
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body as CreateResourceInput;
    
    // Check for duplicate name - return 409 Conflict
    const existing = await this.service.findByName(name);
    if (existing) {
      throw Errors.conflict(ResourceName.RESOURCE, ResourceFields.NAME, name);
    }
    
    const resource = await this.service.createResource({ 
      name, 
      description: description ?? null 
    });
    
    res.status(HttpStatus.CREATED).json({ status: 'success', data: resource });
  });

  /**
   * GET /api/v1/resources
   * List resources with filters, pagination, and sorting
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = (req as Request & { validatedQuery: ListResourcesQuery }).validatedQuery;
    
    const result = await this.service.listResources({ 
      name: query.name, 
      description: query.description,
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
      order: query.order as typeof SortOrder.ASC | typeof SortOrder.DESC
    });
    
    res.status(HttpStatus.OK).json({ 
      status: 'success', 
      data: result.data,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + result.data.length < result.total
      }
    });
  });

  /**
   * GET /api/v1/resources/:id
   * Get a single resource by ID
   */
  get = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params[ResourceFields.ID]);
    
    const resource = await this.service.getResource(id);
    if (!resource) {
      throw Errors.notFound(ResourceName.RESOURCE, id);
    }
    
    res.status(HttpStatus.OK).json({ status: 'success', data: resource });
  });

  /**
   * PUT /api/v1/resources/:id
   * Full replacement of a resource (all fields required)
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params[ResourceFields.ID]);
    const { name, description } = req.body as UpdateResourceInput;
    
    // Check if resource exists
    const existing = await this.service.getResource(id);
    if (!existing) {
      throw Errors.notFound(ResourceName.RESOURCE, id);
    }
    
    // Check for name conflict with other resources
    if (name !== existing.name) {
      const duplicate = await this.service.findByName(name);
      if (duplicate) {
        throw Errors.conflict(ResourceName.RESOURCE, ResourceFields.NAME, name);
      }
    }
    
    const resource = await this.service.updateResource(id, { 
      name, 
      description: description ?? null 
    });
    
    res.status(HttpStatus.OK).json({ status: 'success', data: resource });
  });

  /**
   * PATCH /api/v1/resources/:id
   * Partial update of a resource
   */
  partialUpdate = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params[ResourceFields.ID]);
    const { name, description } = req.body as PartialUpdateResourceInput;
    
    // Check if resource exists
    const existing = await this.service.getResource(id);
    if (!existing) {
      throw Errors.notFound(ResourceName.RESOURCE, id);
    }
    
    // Check for name conflict with other resources
    if (name !== undefined && name !== existing.name) {
      const duplicate = await this.service.findByName(name);
      if (duplicate) {
        throw Errors.conflict(ResourceName.RESOURCE, ResourceFields.NAME, name);
      }
    }
    
    // Build partial update object
    const updateData: Partial<{ name: string; description: string | null }> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    
    const resource = await this.service.partialUpdateResource(id, updateData);
    
    res.status(HttpStatus.OK).json({ status: 'success', data: resource });
  });

  /**
   * DELETE /api/v1/resources/:id
   * Delete a resource
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params[ResourceFields.ID]);
    
    const success = await this.service.deleteResource(id);
    if (!success) {
      throw Errors.notFound(ResourceName.RESOURCE, id);
    }
    
    res.status(HttpStatus.NO_CONTENT).send();
  });
}

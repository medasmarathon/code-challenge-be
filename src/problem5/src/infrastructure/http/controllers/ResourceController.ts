/**
 * Resource Controller - Infrastructure HTTP Layer
 * 
 * Handles HTTP request/response and delegates to use cases.
 * Controllers are thin - they just translate HTTP to use cases.
 */

import { Request, Response } from 'express';
import { 
  ICreateResourceUseCase,
  IGetResourceUseCase,
  IListResourcesUseCase,
  IUpdateResourceUseCase,
  IPartialUpdateResourceUseCase,
  IDeleteResourceUseCase
} from '../../../application/use-cases';
import { ListResourcesDTO } from '../../../application/dtos';
import { EntityNotFoundError, EntityConflictError } from '../../../domain/errors/DomainError';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpStatus } from '../utils/constants';
import { ResourcePresenter } from '../presenters/ResourcePresenter';
import { 
  CreateResourceInput, 
  UpdateResourceInput, 
  PartialUpdateResourceInput,
  ListResourcesQuery
} from '../schemas/resourceSchema';

/**
 * Container for all use cases needed by the controller
 */
export interface ResourceUseCases {
  createResource: ICreateResourceUseCase;
  getResource: IGetResourceUseCase;
  listResources: IListResourcesUseCase;
  updateResource: IUpdateResourceUseCase;
  partialUpdateResource: IPartialUpdateResourceUseCase;
  deleteResource: IDeleteResourceUseCase;
}

/**
 * Controller for Resource HTTP endpoints
 * Handles request/response, delegates business logic to use cases
 */
export class ResourceController {
  constructor(private readonly useCases: ResourceUseCases) {}

  /**
   * POST /api/v1/resources
   * Create a new resource
   * Returns: 201 Created with resource data
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body as CreateResourceInput;
    
    try {
      const resource = await this.useCases.createResource.execute({ 
        name, 
        description: description ?? null 
      });
      
      res.status(HttpStatus.CREATED).json(ResourcePresenter.toSuccessResponse(resource));
    } catch (error) {
      if (error instanceof EntityConflictError) {
        throw ResourcePresenter.toConflictError(error);
      }
      throw error;
    }
  });

  /**
   * GET /api/v1/resources
   * List resources with filters, pagination, and sorting
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = (req as Request & { validatedQuery: ListResourcesQuery }).validatedQuery;
    
    const options: ListResourcesDTO = {
      name: query.name,
      description: query.description,
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
      order: query.order,
    };

    const result = await this.useCases.listResources.execute(options);
    
    res.status(HttpStatus.OK).json(
      ResourcePresenter.toListResponse(result, options)
    );
  });

  /**
   * GET /api/v1/resources/:id
   * Get a single resource by ID
   */
  get = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    
    try {
      const resource = await this.useCases.getResource.execute(id);
      res.status(HttpStatus.OK).json(ResourcePresenter.toSuccessResponse(resource));
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw ResourcePresenter.toNotFoundError(error);
      }
      throw error;
    }
  });

  /**
   * PUT /api/v1/resources/:id
   * Full replacement of a resource (all fields required)
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { name, description } = req.body as UpdateResourceInput;
    
    try {
      const resource = await this.useCases.updateResource.execute(id, { 
        name, 
        description: description ?? null 
      });
      
      res.status(HttpStatus.OK).json(ResourcePresenter.toSuccessResponse(resource));
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw ResourcePresenter.toNotFoundError(error);
      }
      if (error instanceof EntityConflictError) {
        throw ResourcePresenter.toConflictError(error);
      }
      throw error;
    }
  });

  /**
   * PATCH /api/v1/resources/:id
   * Partial update of a resource
   */
  partialUpdate = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { name, description } = req.body as PartialUpdateResourceInput;
    
    try {
      const resource = await this.useCases.partialUpdateResource.execute(id, { 
        name, 
        description 
      });
      
      res.status(HttpStatus.OK).json(ResourcePresenter.toSuccessResponse(resource));
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw ResourcePresenter.toNotFoundError(error);
      }
      if (error instanceof EntityConflictError) {
        throw ResourcePresenter.toConflictError(error);
      }
      throw error;
    }
  });

  /**
   * DELETE /api/v1/resources/:id
   * Delete a resource
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    
    try {
      await this.useCases.deleteResource.execute(id);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw ResourcePresenter.toNotFoundError(error);
      }
      throw error;
    }
  });
}

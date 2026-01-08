import { Router } from 'express';
import { ResourceController } from '../controllers/resourceController';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { 
  createResourceSchema, 
  updateResourceSchema, 
  partialUpdateResourceSchema,
  idParamSchema,
  listResourcesQuerySchema
} from '../schemas/resourceSchema';

/**
 * Creates resource routes with injected controller
 * Enables dependency injection for testing
 * 
 * @param controller - ResourceController instance (injected for testability)
 * @returns Express Router with all resource routes configured
 */
export function createResourceRoutes(controller: ResourceController): Router {
  const router = Router();

  /**
   * RESTful CRUD endpoints for resources
   * 
   * Base path: /api/v1/resources (mounted in app.ts)
   * 
   * Endpoints:
   * - POST   /              Create a new resource
   * - GET    /              List resources (with pagination, filtering, sorting)
   * - GET    /:id           Get a single resource
   * - PUT    /:id           Full replacement update
   * - PATCH  /:id           Partial update
   * - DELETE /:id           Delete a resource
   */

  // Collection routes
  router.post('/', 
    validateBody(createResourceSchema), 
    controller.create
  );

  router.get('/', 
    validateQuery(listResourcesQuerySchema),
    controller.list
  );

  // Item routes (with ID validation)
  router.get('/:id', 
    validateParams(idParamSchema), 
    controller.get
  );

  router.put('/:id', 
    validateParams(idParamSchema), 
    validateBody(updateResourceSchema), 
    controller.update
  );

  router.patch('/:id', 
    validateParams(idParamSchema), 
    validateBody(partialUpdateResourceSchema), 
    controller.partialUpdate
  );

  router.delete('/:id', 
    validateParams(idParamSchema), 
    controller.delete
  );

  return router;
}

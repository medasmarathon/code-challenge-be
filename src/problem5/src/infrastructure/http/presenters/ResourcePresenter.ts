/**
 * Resource Presenter - Infrastructure HTTP Layer
 * 
 * Transforms use case responses to HTTP responses.
 * Keeps presentation logic separate from business logic.
 */

import { ResourceResponseDTO, ListResourcesResponseDTO, ListResourcesDTO } from '../../../application/dtos';
import { EntityNotFoundError, EntityConflictError } from '../../../domain/errors/DomainError';
import { AppError } from '../utils/AppError';
import { HttpStatus, ErrorCode } from '../utils/constants';

/**
 * API response format for success
 */
export interface SuccessResponse<T> {
  status: 'success';
  data: T;
}

/**
 * API response format for paginated list
 */
export interface PaginatedResponse<T> {
  status: 'success';
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Presenter for Resource HTTP responses
 */
export class ResourcePresenter {
  /**
   * Format a single resource response
   */
  static toSuccessResponse(resource: ResourceResponseDTO): SuccessResponse<ResourceResponseDTO> {
    return {
      status: 'success',
      data: resource,
    };
  }

  /**
   * Format a paginated list response
   */
  static toListResponse(
    result: ListResourcesResponseDTO,
    options: ListResourcesDTO
  ): PaginatedResponse<ResourceResponseDTO> {
    return {
      status: 'success',
      data: result.data,
      pagination: {
        total: result.total,
        limit: options.limit,
        offset: options.offset,
        hasMore: options.offset + result.data.length < result.total,
      },
    };
  }

  /**
   * Transform domain not found error to HTTP error
   */
  static toNotFoundError(error: EntityNotFoundError): AppError {
    return new AppError(
      `${error.entityName} not found`,
      HttpStatus.NOT_FOUND,
      ErrorCode.RESOURCE_NOT_FOUND,
      `The ${error.entityName.toLowerCase()} with ID '${error.entityId}' does not exist`
    );
  }

  /**
   * Transform domain conflict error to HTTP error
   */
  static toConflictError(error: EntityConflictError): AppError {
    return new AppError(
      `${error.entityName} with this ${error.field} already exists`,
      HttpStatus.CONFLICT,
      ErrorCode.RESOURCE_CONFLICT,
      `A ${error.entityName.toLowerCase()} with ${error.field} '${error.value}' already exists in the system`
    );
  }
}

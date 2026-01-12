import { ZodError } from 'zod';
import { HttpStatus, ErrorCode, ErrorCodeType, HttpStatusCode } from './constants';

/**
 * Custom error class for API errors with RESTful conventions
 * Includes error code for programmatic identification
 */
export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: ErrorCodeType;
  public readonly isOperational: boolean;
  public readonly details?: string;

  constructor(
    message: string, 
    statusCode: HttpStatusCode, 
    code?: ErrorCodeType,
    details?: string,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? this.getDefaultCode(statusCode);
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  private getDefaultCode(statusCode: HttpStatusCode): ErrorCodeType {
    const codeMap: Partial<Record<HttpStatusCode, ErrorCodeType>> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.RESOURCE_NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.RESOURCE_CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_ERROR,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.INTERNAL_SERVER_ERROR
    };
    return codeMap[statusCode] ?? ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Create AppError from Zod validation error
   */
  static fromZodError(error: ZodError): AppError {
    const firstIssue = error.issues[0];
    const field = firstIssue.path.join('.');
    const message = firstIssue.message;
    const details = error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    return new AppError(
      field ? `${field}: ${message}` : message,
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      details
    );
  }
}

/**
 * Factory functions for common errors - promotes DRY principle
 */
export const Errors = {
  notFound: (resource: string, id?: string | number) => 
    new AppError(
      `${resource} not found`,
      HttpStatus.NOT_FOUND,
      ErrorCode.RESOURCE_NOT_FOUND,
      id ? `The ${resource.toLowerCase()} with ID '${id}' does not exist` : undefined
    ),

  badRequest: (message: string, details?: string) => 
    new AppError(
      message, 
      HttpStatus.BAD_REQUEST, 
      ErrorCode.VALIDATION_ERROR, 
      details
    ),

  conflict: (resource: string, field: string, value: string) => 
    new AppError(
      `${resource} with this ${field} already exists`,
      HttpStatus.CONFLICT,
      ErrorCode.RESOURCE_CONFLICT,
      `A ${resource.toLowerCase()} with ${field} '${value}' already exists in the system`
    ),

  invalidId: () => 
    new AppError(
      'Invalid resource ID',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_ID,
      'The provided ID must be a valid positive integer'
    ),

  missingField: (field: string) => 
    new AppError(
      `${field} is required`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.MISSING_REQUIRED_FIELD,
      `The '${field.toLowerCase()}' field must be provided in the request body`
    ),

  unprocessableEntity: (message: string, details?: string) => 
    new AppError(
      message, 
      HttpStatus.UNPROCESSABLE_ENTITY, 
      ErrorCode.VALIDATION_ERROR, 
      details
    ),

  internal: (message = 'An unexpected error occurred') =>
    new AppError(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.INTERNAL_SERVER_ERROR
    )
};

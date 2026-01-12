import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { HttpStatus, ErrorCode } from '../utils/constants';

/**
 * RESTful error response format
 * Includes timestamp, path, and structured error details
 */
interface ErrorResponse {
  status: 'error';
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: string;
    timestamp: string;
    path: string;
  };
}

export const errorHandler = (
  err: Error, 
  req: Request, 
  res: Response, 
  _next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl;

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      status: 'error',
      statusCode: err.statusCode,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp,
        path
      }
    };

    return res.status(err.statusCode).json(response);
  }

  // Log unexpected errors for debugging
  console.error('Unexpected Error:', err);

  // Don't expose internal error details in production
  const response: ErrorResponse = {
    status: 'error',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      timestamp,
      path
    }
  };

  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
};

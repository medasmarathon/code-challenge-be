import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

/**
 * Generic Zod validation middleware factory
 * Validates request body, params, or query against a Zod schema
 */
type RequestPart = 'body' | 'params' | 'query';

export const validate = <T>(schema: ZodSchema<T>, part: RequestPart = 'body') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req[part]);
      
      // Store validated/transformed data
      // req.body is writable, but req.query and req.params are read-only getters in Express 5.x
      if (part === 'body') {
        req.body = result;
      } else if (part === 'query') {
        // Store validated query with defaults/transforms in a custom property
        (req as Request & { validatedQuery: T }).validatedQuery = result;
      } else if (part === 'params') {
        // Store validated params with transforms in a custom property
        (req as Request & { validatedParams: T }).validatedParams = result;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(AppError.fromZodError(error));
      }
      next(error);
    }
  };
};

/**
 * Shorthand validators
 */
export const validateBody = <T>(schema: ZodSchema<T>) => validate(schema, 'body');
export const validateParams = <T>(schema: ZodSchema<T>) => validate(schema, 'params');
export const validateQuery = <T>(schema: ZodSchema<T>) => validate(schema, 'query');

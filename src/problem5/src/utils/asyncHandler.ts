import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Async handler wrapper to eliminate try-catch boilerplate
 * Catches any errors and forwards to error handler middleware
 * Promotes DRY by removing repetitive try-catch blocks
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

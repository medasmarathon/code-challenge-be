import { z } from 'zod';
import { ValidationConstraints, ResourceFields, SortFields, SortOrder, Pagination } from '../utils/constants';

/**
 * Error messages for validation
 */
const ErrorMessages = {
  NAME_REQUIRED: `${ResourceFields.NAME} is required`,
  NAME_STRING: `${ResourceFields.NAME} must be a string`,
  NAME_EMPTY: `${ResourceFields.NAME} cannot be empty or whitespace only`,
  NAME_TOO_LONG: `${ResourceFields.NAME} must be at most ${ValidationConstraints.NAME_MAX_LENGTH} characters`,
  DESCRIPTION_STRING: `${ResourceFields.DESCRIPTION} must be a string`,
  DESCRIPTION_TOO_LONG: `${ResourceFields.DESCRIPTION} must be at most ${ValidationConstraints.DESCRIPTION_MAX_LENGTH} characters`,
  AT_LEAST_ONE_FIELD: `At least one field (${ResourceFields.NAME} or ${ResourceFields.DESCRIPTION}) is required`,
  INVALID_ID: 'ID must be a valid positive integer'
} as const;

/**
 * Required name schema with trim to prevent whitespace-only names
 */
const requiredNameSchema = z
  .string({
    error: (issue) => issue.input === undefined 
      ? ErrorMessages.NAME_REQUIRED 
      : ErrorMessages.NAME_STRING
  })
  .trim() // Remove leading/trailing whitespace
  .min(ValidationConstraints.NAME_MIN_LENGTH, { error: ErrorMessages.NAME_EMPTY })
  .max(ValidationConstraints.NAME_MAX_LENGTH, { error: ErrorMessages.NAME_TOO_LONG });

/**
 * Optional name schema with trim
 */
const optionalNameSchema = z
  .string({ error: ErrorMessages.NAME_STRING })
  .trim()
  .min(ValidationConstraints.NAME_MIN_LENGTH, { error: ErrorMessages.NAME_EMPTY })
  .max(ValidationConstraints.NAME_MAX_LENGTH, { error: ErrorMessages.NAME_TOO_LONG })
  .optional();

/**
 * Description schema (always optional) with trim
 */
const descriptionSchema = z
  .string({ error: ErrorMessages.DESCRIPTION_STRING })
  .trim()
  .max(ValidationConstraints.DESCRIPTION_MAX_LENGTH, { error: ErrorMessages.DESCRIPTION_TOO_LONG })
  .nullable()
  .optional();

/**
 * Resource create schema
 * Used for POST /api/v1/resources
 */
export const createResourceSchema = z.object({
  name: requiredNameSchema,
  description: descriptionSchema
}).strict();

export type CreateResourceInput = z.infer<typeof createResourceSchema>;

/**
 * Resource full update schema (PUT)
 * All required fields must be provided
 */
export const updateResourceSchema = z.object({
  name: requiredNameSchema,
  description: descriptionSchema
}).strict();

export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

/**
 * Resource partial update schema (PATCH)
 * At least one field must be provided
 */
export const partialUpdateResourceSchema = z.object({
  name: optionalNameSchema,
  description: descriptionSchema
}).strict().refine(
  data => data.name !== undefined || data.description !== undefined,
  { message: ErrorMessages.AT_LEAST_ONE_FIELD }
);

export type PartialUpdateResourceInput = z.infer<typeof partialUpdateResourceSchema>;

/**
 * Resource ID parameter schema
 */
export const idParamSchema = z.object({
  id: z
    .string()
    .transform((val, ctx) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: ErrorMessages.INVALID_ID
        });
        return z.NEVER;
      }
      return parsed;
    })
});

export type IdParam = z.infer<typeof idParamSchema>;

/**
 * List resources query schema
 * Includes pagination, filtering, and sorting
 */
export const listResourcesQuerySchema = z.object({
  // Filtering
  name: z.string().optional(),
  description: z.string().optional(),
  
  // Pagination
  limit: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return Pagination.DEFAULT_LIMIT;
      const parsed = parseInt(val, 10);
      return Math.min(Math.max(parsed, 1), Pagination.MAX_LIMIT);
    }),
  
  offset: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return Pagination.DEFAULT_OFFSET;
      const parsed = parseInt(val, 10);
      return Math.max(parsed, 0);
    }),
  
  // Sorting
  sort: z
    .enum([SortFields.ID, SortFields.NAME, SortFields.CREATED_AT, SortFields.UPDATED_AT])
    .default(SortFields.ID),
  
  order: z
    .enum([SortOrder.ASC, SortOrder.DESC])
    .default(SortOrder.ASC)
});

export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;

/**
 * List Resources DTO - Application Layer
 * 
 * Data Transfer Object for listing resources with filtering and pagination.
 */

export type SortField = 'id' | 'name' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export interface ListResourcesDTO {
  name?: string;
  description?: string;
  limit: number;
  offset: number;
  sort: SortField;
  order: SortOrder;
}

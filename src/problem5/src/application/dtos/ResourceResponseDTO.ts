/**
 * Resource Response DTO - Application Layer
 * 
 * Data Transfer Object for resource responses.
 * This is what gets returned from use cases and
 * ultimately serialized to JSON for API responses.
 */

/**
 * Single resource response
 */
export interface ResourceResponseDTO {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Paginated list of resources response
 */
export interface ListResourcesResponseDTO {
  data: ResourceResponseDTO[];
  total: number;
}

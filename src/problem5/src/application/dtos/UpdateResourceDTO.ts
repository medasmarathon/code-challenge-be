/**
 * Update Resource DTO - Application Layer
 * 
 * Data Transfer Object for updating a resource.
 */

/**
 * Full update - all fields required
 */
export interface UpdateResourceDTO {
  name: string;
  description: string | null;
}

/**
 * Partial update - all fields optional
 */
export interface PartialUpdateResourceDTO {
  name?: string;
  description?: string | null;
}

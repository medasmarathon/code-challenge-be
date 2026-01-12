/**
 * Create Resource DTO - Application Layer
 * 
 * Data Transfer Object for creating a new resource.
 * DTOs are simple data containers used to transfer data
 * between layers without exposing domain entities.
 */

export interface CreateResourceDTO {
  name: string;
  description: string | null;
}

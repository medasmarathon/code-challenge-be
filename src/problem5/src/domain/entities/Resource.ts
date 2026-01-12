/**
 * Resource Entity - Domain Layer
 * 
 * This is the core domain entity representing a Resource.
 * It contains business rules and validation that are independent
 * of any framework or infrastructure.
 */

export interface ResourceProps {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateResourceProps {
  name: string;
  description: string | null;
}

export interface UpdateResourceProps {
  name: string;
  description: string | null;
}

export interface PartialUpdateResourceProps {
  name?: string;
  description?: string | null;
}

/**
 * Resource Entity
 * 
 * Encapsulates business logic and validation rules for a Resource.
 * The entity is immutable - updates return new instances.
 */
export class Resource {
  private readonly props: ResourceProps;

  private constructor(props: ResourceProps) {
    this.props = Object.freeze({ ...props });
  }

  // Getters
  get id(): number {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Factory method to create a new Resource entity
   */
  static create(props: ResourceProps): Resource {
    Resource.validateName(props.name);
    Resource.validateDescription(props.description);
    return new Resource(props);
  }

  /**
   * Factory method to reconstitute a Resource from persistence
   */
  static reconstitute(props: ResourceProps): Resource {
    return new Resource(props);
  }

  /**
   * Update the resource with new values
   * Returns a new Resource instance (immutability)
   */
  update(props: UpdateResourceProps, updatedAt: Date): Resource {
    Resource.validateName(props.name);
    Resource.validateDescription(props.description);
    
    return new Resource({
      ...this.props,
      name: props.name,
      description: props.description,
      updatedAt,
    });
  }

  /**
   * Partially update the resource
   * Returns a new Resource instance (immutability)
   */
  partialUpdate(props: PartialUpdateResourceProps, updatedAt: Date): Resource {
    const newName = props.name !== undefined ? props.name : this.props.name;
    const newDescription = props.description !== undefined ? props.description : this.props.description;
    
    Resource.validateName(newName);
    Resource.validateDescription(newDescription);
    
    return new Resource({
      ...this.props,
      name: newName,
      description: newDescription,
      updatedAt,
    });
  }

  /**
   * Convert entity to plain object (for serialization)
   */
  toJSON(): ResourceProps {
    return { ...this.props };
  }

  // Validation methods
  private static validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Resource name cannot be empty');
    }
    if (name.length > 255) {
      throw new Error('Resource name cannot exceed 255 characters');
    }
  }

  private static validateDescription(description: string | null): void {
    if (description !== null && description.length > 1000) {
      throw new Error('Resource description cannot exceed 1000 characters');
    }
  }
}

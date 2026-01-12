/**
 * Domain Errors - Domain Layer
 * 
 * Custom error classes for domain-specific exceptions.
 * These errors are independent of any framework and represent
 * business rule violations.
 */

/**
 * Base class for all domain errors
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when an entity is not found
 */
export class EntityNotFoundError extends DomainError {
  readonly code = 'ENTITY_NOT_FOUND';
  readonly entityName: string;
  readonly entityId: number | string;

  constructor(entityName: string, entityId: number | string) {
    super(`${entityName} with id '${entityId}' not found`);
    this.entityName = entityName;
    this.entityId = entityId;
  }
}

/**
 * Thrown when there's a conflict (e.g., duplicate name)
 */
export class EntityConflictError extends DomainError {
  readonly code = 'ENTITY_CONFLICT';
  readonly entityName: string;
  readonly field: string;
  readonly value: string;

  constructor(entityName: string, field: string, value: string) {
    super(`${entityName} with ${field} '${value}' already exists`);
    this.entityName = entityName;
    this.field = field;
    this.value = value;
  }
}

/**
 * Thrown when a validation rule is violated
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

/**
 * Thrown when a business rule is violated
 */
export class BusinessRuleViolationError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly rule: string;

  constructor(rule: string, message: string) {
    super(message);
    this.rule = rule;
  }
}

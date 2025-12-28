# Problem 5: CRUD Server

A RESTful backend server with ExpressJS and TypeScript, providing a CRUD interface for resources.

## Overview

This project implements a RESTful API server following industry best practices and conventions. The API provides complete CRUD (Create, Read, Update, Delete) operations for a generic "Resource" entity, with support for pagination, filtering, sorting, and comprehensive error handling.

### Approach

1. **RESTful Design**: All endpoints follow REST conventions - using nouns for resources, proper HTTP methods, and standard status codes.
2. **Layered Architecture**: Separation of concerns with Controller → Service → Repository pattern.
3. **Type Safety**: Full TypeScript implementation with Zod for runtime validation and type inference.
4. **Error Handling**: Centralized error handling with structured error responses including error codes.

### Assumptions

1. **Single Resource Type**: The API manages a generic "Resource" entity with `name` and `description` fields. This can be extended for other entity types.
2. **Unique Names**: Resource names must be unique (enforced with 409 Conflict on duplicates).
3. **SQLite Database**: Using SQLite for simplicity and portability. For production, consider PostgreSQL or MySQL.
4. **No Authentication**: Authentication/authorization is not implemented. In production, add JWT or session-based auth.
5. **Auto-increment IDs**: Using auto-increment integer IDs for simplicity. Note: This can expose sequential patterns; consider UUIDs for production.

## Design Decisions

### 1. API Versioning (`/api/v1`)
- **Decision**: Prefix all routes with `/api/v1`
- **Rationale**: Allows backward-compatible API evolution without breaking existing clients

### 2. PUT vs PATCH
- **Decision**: Implement both PUT (full replacement) and PATCH (partial update)
- **Rationale**: Follows HTTP semantics - PUT replaces entire resource, PATCH modifies specific fields

### 3. Zod for Validation
- **Decision**: Use Zod instead of express-validator or Joi
- **Rationale**: 
  - Type inference from schemas (single source of truth)
  - Better TypeScript integration
  - Modern API with excellent error messages

### 4. Error Factory Pattern
- **Decision**: Create `Errors` object with factory methods for common errors
- **Rationale**: DRY principle - consistent error creation across the codebase

### 5. Constants Module
- **Decision**: Centralize all magic strings/numbers in `constants.ts`
- **Rationale**: Easy maintenance, prevents typos, enables refactoring

### 6. Async Handler Wrapper
- **Decision**: Use `asyncHandler` utility instead of try-catch in each controller method
- **Rationale**: DRY principle - eliminates repetitive error handling boilerplate

### 7. Pagination
- **Decision**: Offset-based pagination with configurable limit
- **Rationale**: Simple to implement and understand. For large datasets, consider cursor-based pagination.

### 8. SQLite with Kysely
- **Decision**: Use Kysely as query builder with SQLite
- **Rationale**: 
  - Type-safe SQL queries
  - SQLite is portable and requires no setup
  - Kysely is battle-tested and performant

## Prerequisites

- Node.js (v18+)
- npm

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   npx ts-node src/app.ts
   ```
   Or use nodemon for development:
   ```bash
   npx nodemon src/app.ts
   ```

The server will start on port 3000 (default).

## RESTful API Endpoints

Base URL: `/api/v1`

### Create Resource
- **Method**: `POST /api/v1/resources`
- **Body**: `{ "name": "Resource Name", "description": "Description" }`
- **Response**: `201 Created` with resource data
- **Errors**: 
  - `400 Bad Request` - Validation failed (empty name, whitespace-only, etc.)
  - `409 Conflict` - Resource with name already exists

### List Resources (with Pagination, Filtering, and Sorting)
- **Method**: `GET /api/v1/resources`
- **Query Parameters**:
  - `name` - Filter by name (substring match)
  - `description` - Filter by description (substring match)
  - `limit` - Number of results per page (default: 10, max: 100)
  - `offset` - Number of results to skip (default: 0)
  - `sort` - Sort field: `id`, `name`, `createdAt`, `updatedAt` (default: `id`)
  - `order` - Sort order: `asc` or `desc` (default: `asc`)
- **Response**: `200 OK` with array of resources and pagination metadata
  ```json
  {
    "status": "success",
    "data": [...],
    "pagination": {
      "total": 100,
      "limit": 10,
      "offset": 0,
      "hasMore": true
    }
  }
  ```

### Get Resource
- **Method**: `GET /api/v1/resources/:id`
- **Response**: `200 OK` with resource data
- **Errors**: 
  - `400 Bad Request` - Invalid ID format
  - `404 Not Found` - Resource not found

### Update Resource (Full Replacement)
- **Method**: `PUT /api/v1/resources/:id`
- **Body**: `{ "name": "New Name", "description": "New Description" }` (name required)
- **Response**: `200 OK` with updated resource
- **Errors**: 
  - `400 Bad Request` - Validation failed or invalid ID
  - `404 Not Found` - Resource not found
  - `409 Conflict` - Resource with name already exists

### Partial Update Resource
- **Method**: `PATCH /api/v1/resources/:id`
- **Body**: `{ "name": "New Name" }` or `{ "description": "New Description" }` (at least one field required)
- **Response**: `200 OK` with updated resource
- **Errors**: 
  - `400 Bad Request` - No fields provided or invalid ID
  - `404 Not Found` - Resource not found
  - `409 Conflict` - Resource with name already exists

### Delete Resource
- **Method**: `DELETE /api/v1/resources/:id`
- **Response**: `204 No Content`
- **Errors**: 
  - `400 Bad Request` - Invalid ID format
  - `404 Not Found` - Resource not found

## Error Response Format

All error responses follow a consistent RESTful structure:

```json
{
  "status": "error",
  "statusCode": 404,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found",
    "details": "The resource with ID '123' does not exist",
    "timestamp": "2024-12-28T10:30:45.123Z",
    "path": "/api/v1/resources/123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data (Zod validation failed) |
| `INVALID_ID` | 400 | ID parameter is not a valid positive integer |
| `MISSING_REQUIRED_FIELD` | 400 | Required field not provided |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist |
| `RESOURCE_CONFLICT` | 409 | Resource with unique field already exists |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200  | OK - Request succeeded |
| 201  | Created - Resource created successfully |
| 204  | No Content - Resource deleted successfully |
| 400  | Bad Request - Invalid input or missing required fields |
| 404  | Not Found - Resource not found |
| 409  | Conflict - Resource with unique field already exists |
| 500  | Internal Server Error - Unexpected error |

## Architecture

```
src/
├── app.ts                 # Application entry point
├── controllers/           # Request handlers (HTTP layer)
│   └── resourceController.ts
├── services/              # Business logic layer
│   └── resourceService.ts
├── repositories/          # Data access layer (Kysely queries)
│   └── resourceRepository.ts
├── middleware/            # Express middleware
│   ├── errorHandler.ts    # Global error handler
│   └── validation.ts      # Zod validation middleware
├── schemas/               # Zod validation schemas
│   └── resourceSchema.ts
├── models/                # Type definitions
│   └── types.ts
├── utils/                 # Utilities
│   ├── constants.ts       # HTTP status codes, error codes, etc.
│   ├── AppError.ts        # Custom error class with factory
│   └── asyncHandler.ts    # Async wrapper for controllers
└── db/
    └── db.ts              # Database connection (Kysely + SQLite)
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|---------------|
| **Controller** | Handle HTTP requests/responses, call services |
| **Service** | Business logic, orchestrate repository calls |
| **Repository** | Database operations, Kysely queries |
| **Middleware** | Cross-cutting concerns (validation, error handling) |

## Technologies

| Technology | Purpose |
|------------|---------|
| Express.js | Web framework |
| TypeScript | Type safety |
| Zod | Schema validation with type inference |
| Kysely | Type-safe SQL query builder |
| SQLite | Database (via better-sqlite3) |

## Testing Considerations

Currently, this project does not include automated tests. In a production environment, consider:

### Unit Tests
- Test individual functions in services and repositories
- Mock database connections
- Use Jest or Vitest

### Integration Tests
- Test API endpoints end-to-end
- Use Supertest with an in-memory SQLite database
- Include setup/teardown to reset database state between tests

### Test Independence
- Each test should be independent and not rely on other tests
- Use `beforeEach`/`afterEach` hooks to prepare and clean up state

## Logging Considerations

Currently using `console.log/console.error`. For production, consider:

- **Winston** or **Pino** for structured logging
- Log levels (debug, info, warn, error)
- Request ID correlation for tracing
- Log rotation and persistence

## Security Considerations

### Current Limitations
1. **No Authentication**: All endpoints are public
2. **Auto-increment IDs**: Exposes sequential patterns (enumeration attack risk)

### Recommendations for Production
1. Add JWT or session-based authentication
2. Use UUIDs instead of auto-increment IDs
3. Implement rate limiting
4. Add request validation for maximum payload size
5. Use HTTPS in production

## Code Quality Principles

This project follows:

| Principle | Implementation |
|-----------|---------------|
| **SOLID** | Single Responsibility in each layer |
| **DRY** | Zod schemas, asyncHandler, Errors factory |
| **KISS** | Simple, readable code structure |
| **Type Safety** | Full TypeScript with Zod validation |

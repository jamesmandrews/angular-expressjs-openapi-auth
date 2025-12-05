# Todo List API - Express.js with OpenAPI

A TypeScript-based REST API for managing a todo list, built with Express.js and OpenAPI validation.

## Features

### Core Functionality
- Full CRUD operations for todo items
- OpenAPI 3.0 specification-driven development
- **Automatic route registration** - Routes are automatically wired from the OpenAPI spec using `operationHandlers`
- **Pluggable authentication system** - OpenAPI spec dictates protected endpoints, authentication logic is customizable
- Automatic request validation using express-openapi-validator
- TypeScript for type safety
- Structured error responses
- In-memory data storage

### Production-Ready Security
- **Helmet.js** - Security headers (CSP, HSTS, etc.)
- **Dynamic CORS** - Configure multiple allowed origins
- **Rate Limiting** - Prevent brute force and API abuse
- **Request Size Limits** - Configurable payload size limits
- **Graceful Shutdown** - Handles SIGTERM/SIGINT properly

### Operational Excellence
- **Structured Logging** - Winston logger with multiple transports
- **Health Check Endpoint** - Monitor server status and metrics
- **Error Tracking** - Proper handling of uncaught exceptions
- **HTTP Request Logging** - Track all requests with response times

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` to configure the application:

```bash
cp .env.example .env
```

### Security & CORS Configuration

```bash
# CORS - Comma-separated list of allowed origins
# The server will dynamically return the requesting origin if it's in this list
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://example.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window

# Request Size Limits
REQUEST_BODY_SIZE_LIMIT=10mb

# Graceful Shutdown
SHUTDOWN_TIMEOUT=10000           # 10 seconds
```

### Authentication Configuration

The application supports pluggable authentication providers. Set `AUTH_PROVIDER` to choose one:

- `stub` (default) - All requests are allowed, useful for development
- `apikey` - Requires `X-API-Key` header
- `jwt` - Requires Bearer token (you'll need to implement JWT verification)

```bash
# Authentication
AUTH_PROVIDER=stub

# For API Key authentication
AUTH_PROVIDER=apikey
API_KEYS=your-key-1,your-key-2,your-key-3

# For JWT authentication
AUTH_PROVIDER=jwt
JWT_SECRET=your-secret-key
JWT_EXPIRY=1h
```

**Protected Endpoints:**
- `POST /api/v1/todos` - Create todo (requires authentication)
- `PUT /api/v1/todos/:todoId` - Update todo (requires authentication)
- `PATCH /api/v1/todos/:todoId` - Partial update (requires authentication)
- `DELETE /api/v1/todos/:todoId` - Delete todo (requires authentication)

**Public Endpoints:**
- `GET /api/v1/todos` - List todos (no authentication required)
- `GET /api/v1/todos/:todoId` - Get todo (no authentication required)
- `GET /api/v1/health` - Health check (no authentication required)

## Running the Application

### Development Mode
```bash
npm run dev
```
The server will start on http://localhost:3000 with hot-reloading enabled.

### Production Mode
```bash
npm run build
npm start
```

### With Authentication
```bash
# Using stub authentication (default)
npm start

# Using API key authentication
AUTH_PROVIDER=apikey API_KEYS=key1,key2 npm start

# Using JWT authentication
AUTH_PROVIDER=jwt JWT_SECRET=your-secret npm start
```

## API Endpoints

All endpoints are prefixed with `/api/v1`:

### Health & Monitoring
- `GET /api/v1/health` - Health check endpoint
  - Returns: server status, uptime, memory usage

### Todo Management
- `GET /api/v1/todos` - Get all todos (public)
  - Query params: `status` (completed|pending), `limit`, `offset`
- `POST /api/v1/todos` - Create a new todo (protected)
- `GET /api/v1/todos/:todoId` - Get a specific todo (public)
- `PUT /api/v1/todos/:todoId` - Update a todo (protected)
- `PATCH /api/v1/todos/:todoId` - Partially update a todo (protected)
- `DELETE /api/v1/todos/:todoId` - Delete a todo (protected)

## Example Requests

### Create a Todo (Protected)
```bash
# With stub authentication (default)
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "description": "Milk, eggs, and bread",
    "priority": "high",
    "dueDate": "2025-11-15T10:00:00Z"
  }'

# With API Key authentication
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "title": "Buy groceries",
    "description": "Milk, eggs, and bread"
  }'
```

### Get All Todos
```bash
curl http://localhost:3000/api/v1/todos
```

### Get Completed Todos with Pagination
```bash
curl "http://localhost:3000/api/v1/todos?status=completed&limit=10&offset=0"
```

### Update a Todo
```bash
curl -X PUT http://localhost:3000/api/v1/todos/{todoId} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries - UPDATED",
    "completed": true
  }'
```

### Partially Update a Todo
```bash
curl -X PATCH http://localhost:3000/api/v1/todos/{todoId} \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true
  }'
```

### Delete a Todo
```bash
curl -X DELETE http://localhost:3000/api/v1/todos/{todoId}
```

## Project Structure

```
├── src/
│   ├── auth/
│   │   ├── authProvider.ts      # Authentication provider interface
│   │   └── providers/
│   │       ├── stubAuth.ts      # Stub auth (always allows)
│   │       ├── jwtAuth.ts       # JWT Bearer token auth
│   │       └── apiKeyAuth.ts    # API Key header auth
│   ├── controllers/
│   │   ├── healthCheck.ts       # GET /health handler
│   │   ├── getAllTodos.ts       # GET /todos handler
│   │   ├── createTodo.ts        # POST /todos handler
│   │   ├── getTodoById.ts       # GET /todos/:id handler
│   │   ├── updateTodo.ts        # PUT /todos/:id handler
│   │   ├── patchTodo.ts         # PATCH /todos/:id handler
│   │   └── deleteTodo.ts        # DELETE /todos/:id handler
│   ├── middleware/
│   │   ├── authMiddleware.ts    # Authentication middleware
│   │   ├── security.ts          # Security middleware (CORS, rate limiting, Helmet)
│   │   └── errorHandler.ts      # Error handling middleware
│   ├── models/
│   │   └── todoStore.ts         # In-memory data store
│   ├── types/
│   │   └── todo.types.ts        # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts            # Winston structured logger
│   ├── app.ts                   # Express app configuration
│   └── server.ts                # Server entry point with graceful shutdown
├── logs/
│   ├── error.log                # Error logs only
│   └── combined.log             # All logs
├── openapi.yaml                 # OpenAPI specification
├── .env.example                # Environment configuration example
├── tsconfig.json               # TypeScript configuration
└── package.json                # Project dependencies
```

## How Automatic Routing Works

This project uses `express-openapi-validator`'s `operationHandlers` feature to automatically wire routes from the OpenAPI specification:

1. **OpenAPI Spec**: Each operation in `openapi.yaml` has an `operationId` and `x-eov-operation-handler` extension:
   ```yaml
   get:
     operationId: getAllTodos
     x-eov-operation-handler: getAllTodos
   ```

2. **Controller Files**: Each handler is a separate file in `src/controllers/` named after the `operationId`, exporting a default function.

3. **Automatic Wiring**: The validator reads the OpenAPI spec and automatically registers routes to their corresponding handlers - no manual route definition needed!

This approach ensures your routes always match your OpenAPI specification and reduces boilerplate code.

## OpenAPI Specification

The API is defined using OpenAPI 3.0.3 specification in `openapi.yaml`. The specification includes:

- Complete endpoint definitions
- Request/response schemas
- Validation rules
- Error response formats

## Validation

Request validation is automatically handled by `express-openapi-validator` based on the OpenAPI specification. Invalid requests will receive structured error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields failed validation",
    "details": [
      {
        "field": "title",
        "message": "Title must be between 1 and 200 characters"
      }
    ]
  }
}
```

## Error Responses

The API returns standardized error responses:

- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication required or failed
- `404 Not Found` - Resource not found
- `422 Validation Error` - Data validation failures
- `500 Internal Server Error` - Server errors

## Authentication

The authentication system is pluggable and OpenAPI-driven:

### How It Works

1. The OpenAPI specification (`openapi.yaml`) defines which endpoints require authentication using the `security` field
2. Authentication providers implement the `AuthProvider` interface
3. The auth middleware reads the OpenAPI spec and enforces security requirements
4. You can swap authentication providers without changing any controller code

### Implementing Custom Authentication

To create a custom authentication provider:

1. Implement the `AuthProvider` interface in `src/auth/authProvider.ts`
2. Add your provider to the switch statement in `src/app.ts`
3. Configure via `AUTH_PROVIDER` environment variable

See `src/auth/providers/` for example implementations.

## Production Features

### Security

**Helmet.js** - Provides secure HTTP headers including:
- Content Security Policy
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options

**Dynamic CORS** - Configure multiple allowed origins in `CORS_ALLOWED_ORIGINS`. The server checks each incoming request origin and returns that specific origin in the `Access-Control-Allow-Origin` header if it's in the allowed list. This allows you to serve multiple domains (e.g., `example.com` and `example2.com`) from the same API.

**Rate Limiting** - Protects against brute force attacks and API abuse:
- Configurable window and max requests
- Returns 429 status with clear error message
- Rate limit info in response headers

**Request Size Limits** - Configurable payload size limits prevent resource exhaustion attacks

### Observability

**Structured Logging** - Winston logger with:
- Color-coded console output
- File transports (error.log and combined.log)
- Timestamp and level for each log entry
- HTTP request logging with response times

**Health Check** - `/api/v1/health` endpoint provides:
- Server status
- Uptime in seconds
- Memory usage (MB)
- Current environment

**Error Tracking** - Handles:
- Uncaught exceptions
- Unhandled promise rejections
- Graceful error logging before shutdown

### Reliability

**Graceful Shutdown** - Properly handles SIGTERM and SIGINT:
- Stops accepting new connections
- Waits for existing connections to complete
- Configurable timeout (default 10s)
- Logs shutdown progress

## Testing

This project includes a comprehensive test suite with Jest and Supertest.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Test Structure

```
tests/
├── setup.ts                    # Global test configuration
├── helpers/
│   └── testHelpers.ts          # Test utilities and fixtures
├── unit/
│   └── auth/                   # Unit tests for auth providers
│       ├── stubAuth.test.ts
│       └── apiKeyAuth.test.ts
└── integration/
    ├── health.test.ts          # Health endpoint tests
    └── todos.test.ts           # Todo API endpoint tests
```

### Writing Tests

**Unit Tests** - Test individual functions/classes in isolation:
```typescript
import { StubAuthProvider } from '../../../src/auth/providers/stubAuth';

describe('StubAuthProvider', () => {
  it('should always return authenticated', async () => {
    const provider = new StubAuthProvider();
    const result = await provider.authenticate(mockRequest, []);
    expect(result.authenticated).toBe(true);
  });
});
```

**Integration Tests** - Test API endpoints end-to-end:
```typescript
import request from 'supertest';
import { createTestApp } from '../helpers/testHelpers';

describe('Todo API', () => {
  const app = createTestApp();

  it('should create a todo', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .send({ title: 'Test Todo' });

    expect(response.status).toBe(201);
  });
});
```

## Scripts

- `npm run dev` - Start development server with hot-reloading
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled application
- `npm run clean` - Remove build output
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

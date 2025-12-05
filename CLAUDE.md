# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a **monorepo** containing both an Angular 19 frontend and Express.js backend, configured for deployment as a single Vercel project.

```
/
├── api/                        # Vercel serverless entry point
│   └── index.ts                # Exports Express app for serverless
├── backend/                    # Express.js OpenAPI application
│   ├── src/
│   │   ├── app.ts              # Express app factory (createApp())
│   │   ├── server.ts           # Development server (not used in production)
│   │   ├── controllers/        # OpenAPI operation handlers
│   │   ├── middleware/         # Auth, security, error handling
│   │   ├── auth/               # Pluggable auth providers
│   │   ├── models/             # Data models (todoStore)
│   │   └── utils/              # Logger, helpers
│   ├── openapi.yaml            # OpenAPI specification
│   ├── tests/                  # Jest tests
│   ├── package.json            # Backend dependencies
│   └── tsconfig.json           # Backend TypeScript config
├── src/                        # Angular 19 application (to be installed)
├── dist/                       # Build output
│   └── backend/                # Compiled Express code
├── package.json                # Root workspace package.json
├── vercel.json                 # Vercel routing configuration
└── tsconfig.json               # Root TypeScript config (when Angular is added)
```

## Build and Run Commands

### Root Level (Monorepo)
- **Build All**: `npm run build` - Builds backend (frontend when added)
- **Build Backend**: `npm run build:backend` - Compile backend TypeScript to `dist/backend/`
- **Build Frontend**: `npm run build:frontend` - (To be configured with Angular)
- **Clean**: `npm run clean` - Remove all build artifacts

### Backend Development
- **Development**: `npm run dev:backend` - Hot-reloading server using nodemon and ts-node
- **Test**: `npm run test:backend` - Run Jest tests
- **Direct**: `cd backend && npm run dev` - Run backend server directly

### Vercel Deployment
- **Build Command**: `npm run build:backend` (configured in vercel.json)
- **Install Command**: `npm install && cd backend && npm install`
- **API Routes**: All requests to `/api/v1/*` are routed to the Express serverless function

## Architecture Overview

### Deployment Pattern: Vercel Serverless

This application is designed for **single Vercel project deployment** with:
1. **Express Backend** → Serverless function at `/api` endpoint
2. **Angular Frontend** → Static files served from root (when installed)
3. **Routing**: `/api/v1/*` → Express API, all other routes → Angular

The Express app runs as a **Vercel serverless function**, not a traditional long-running server:
- Entry point: `api/index.ts` imports compiled app from `dist/backend/app.js`
- No server.ts in production (serverless is stateless)
- OpenAPI automatic route registration still works
- Cold starts: ~1-2 seconds on first request

### Backend: OpenAPI-First Design

The backend is an OpenAPI-driven Express.js application using **automatic route registration** via `express-openapi-validator`'s `operationHandlers` feature.

**Route registration happens automatically** - routes are NOT manually defined in code. The system works as follows:

1. **OpenAPI Spec is Source of Truth** (`backend/openapi.yaml`):
   - Each operation defines both `operationId` and `x-eov-operation-handler`
   - These must match the controller filename exactly
   - Example: `operationId: getAllTodos` → `x-eov-operation-handler: getAllTodos` → `backend/src/controllers/getAllTodos.ts`

2. **Controller Convention**:
   - Each controller is a separate file named after the `operationId`
   - Must export a **default function** with signature: `(req: Request, res: Response, next: NextFunction) => Promise<void>`
   - The validator automatically loads and wires these handlers at startup

3. **Validation is Automatic**:
   - All request validation happens via `express-openapi-validator` middleware (`backend/src/app.ts:61-69`)
   - Validation rules come from OpenAPI schemas (min/max length, required fields, enums, etc.)
   - No manual validation code needed in controllers

### Critical Configuration

**In `backend/src/app.ts`:**
- `operationHandlers: operationHandlersPath` points to `dist/backend/controllers` (after build)
- The validator reads `openapi.yaml` and auto-registers routes
- Error handlers must be registered AFTER the validator middleware

**In `api/index.ts`:**
- Imports `createApp()` from compiled `dist/backend/app.js`
- Exports Express app for Vercel's serverless runtime
- Must point to compiled code (not source TypeScript)

**TypeScript Configuration:**
- Backend compiles to `../dist/backend/` (from backend/tsconfig.json)
- Uses strict mode with `noUnusedLocals`, `noUnusedParameters` enabled
- Prefix unused params with `_` (e.g., `_req`, `_next`) to avoid compilation errors

### Data Flow

```
Request → Vercel Edge Network
        → Routing decision (vercel.json)
        → /api/v1/* → api/index.ts (Express serverless function)
                    → Security middleware (Helmet, CORS, Rate limiting)
                    → Request logger
                    → Custom auth middleware (reads OpenAPI security requirements)
                    → express-openapi-validator (validates against OpenAPI spec)
                    → Auto-loaded controller (based on operationId)
                    → todoStore (in-memory Map)
                    → Response (logged with status/timing)
                    → Error handler middleware (if error occurred)
        → /* → Angular static files (when installed)
```

### Error Response Structure

All errors follow the schema defined in `backend/openapi.yaml`:
```typescript
{
  error: {
    code: string,      // e.g., "VALIDATION_ERROR", "RESOURCE_NOT_FOUND"
    message: string,
    details?: Array<{ field: string, message: string }>
  }
}
```

Error handlers in `backend/src/middleware/errorHandler.ts` format express-openapi-validator errors to match this schema.

## Authentication System

This application uses a **pluggable authentication system** where the OpenAPI spec dictates which endpoints require authentication.

### How It Works

1. **OpenAPI Spec Defines Security** (`backend/openapi.yaml`):
   - `securitySchemes` in components section define available auth methods (bearerAuth, apiKeyAuth)
   - Individual operations include `security` array to mark them as protected
   - Operations without `security` field are public (no authentication required)

2. **Pluggable Auth Providers** (`backend/src/auth/providers/`):
   - Interface defined in `backend/src/auth/authProvider.ts`
   - Three implementations provided:
     - `stubAuth.ts` - Always allows (development/testing)
     - `jwtAuth.ts` - JWT Bearer token validation (placeholder pattern)
     - `apiKeyAuth.ts` - X-API-Key header validation
   - Easy to implement custom providers by implementing `AuthProvider` interface

3. **Auth Middleware** (`backend/src/middleware/authMiddleware.ts`):
   - Reads OpenAPI spec to determine security requirements per route
   - Calls configured provider's `authenticate()` method
   - Returns 401 if authentication fails
   - Attaches user info to `req.user` on success

### Configuration

Set `AUTH_PROVIDER` environment variable in Vercel dashboard to choose provider:

```bash
AUTH_PROVIDER=stub      # All requests allowed (default)
AUTH_PROVIDER=apikey    # Requires X-API-Key header
AUTH_PROVIDER=jwt       # Requires Bearer token
```

API Key provider configuration:
```bash
API_KEYS=key1,key2,key3  # Comma-separated list of valid keys
```

See `backend/.env.example` for full configuration options.

### Protecting Endpoints

To protect an endpoint in `backend/openapi.yaml`:

```yaml
paths:
  /todos:
    post:
      operationId: createTodo
      security:
        - bearerAuth: []    # Requires JWT
        - apiKeyAuth: []    # OR API Key
```

Omit `security` array for public endpoints (like GET operations).

## Production Features

### Security Middleware (`backend/src/middleware/security.ts`)

- **Helmet** - Security headers (CSP, HSTS, etc.) configured via `configureHelmet()`
- **Dynamic CORS** - `createCorsMiddleware()` checks request origin against allowed list
- **Rate Limiting** - `createRateLimiter()` prevents brute force (configurable via env)
- **Request Logging** - `requestLogger()` logs all HTTP requests with timing

Configuration via Vercel environment variables:
- `CORS_ALLOWED_ORIGINS` - Comma-separated origins (include your Vercel deployment URL)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window
- `REQUEST_BODY_SIZE_LIMIT` - Body size limit (e.g., "10mb")

### Structured Logging (`backend/src/utils/logger.ts`)

Winston logger with:
- Console transport with colors
- File transports (error.log, combined.log in `logs/` directory)
- Log levels: error, warn, info, http, debug
- Auto-adjusts level based on NODE_ENV

**Usage:** Replace all `console.log()` with `logger.info()`, `logger.error()`, etc.

**Important - Vercel Serverless Logging:**
- File system writes in Vercel serverless functions are **ephemeral** and not persisted
- File-based logs (logs/error.log, logs/combined.log) will be lost after each function invocation
- **Console logs are automatically captured** by Vercel and viewable in the Vercel dashboard
- For production on Vercel:
  - Use `logger.info()`, `logger.error()`, etc. - they output to console which Vercel captures
  - Consider integrating external logging services (Datadog, LogRocket, Sentry) for persistent logs
  - The file transports will work in development but are ignored in serverless production

### Health Check

Endpoint: `GET /api/v1/health` (public, no auth required)
Controller: `backend/src/controllers/healthCheck.ts`
Returns: status, timestamp, uptime, environment, memory usage

## Adding New Backend Endpoints

1. **Add operation to `backend/openapi.yaml`**:
   - Define path, method, parameters, request/response schemas
   - Set `operationId` (e.g., `markTodoComplete`)
   - Set `x-eov-operation-handler` to same value

2. **Create controller file**: `backend/src/controllers/markTodoComplete.ts`
   - Export default async function
   - Access validated data from `req.body`, `req.params`, `req.query`
   - Return responses matching OpenAPI schema

3. **Rebuild**: `npm run build:backend` (routes auto-register on next deployment)

## Adding Angular Frontend (Not Yet Installed)

To add the Angular 19 frontend:

1. **Install Angular CLI**: `npm install -g @angular/cli`
2. **Create Angular app in src/**: `ng new . --directory=src --routing --style=scss`
3. **Update root package.json**:
   - Add Angular build script: `"build:frontend": "cd src && ng build"`
   - Update `build:all` to include frontend build
4. **Update vercel.json**:
   - Set `outputDirectory` to Angular's build output (typically `dist/browser`)
   - Add catch-all route for Angular client-side routing
5. **Configure environment**: Create `src/environments/` files with API base URL

## Important Constraints

### Backend
- **No manual route definitions** - adding routes in `backend/src/app.ts` will create conflicts
- **Controller filenames must exactly match** the `x-eov-operation-handler` value
- **Default exports required** - named exports won't be found by the validator
- Use **Node.js built-in `crypto.randomUUID()`** instead of the `uuid` package (ES module compatibility)
- **Authentication runs before validation** - auth middleware processes requests before OpenAPI validator
- **`validateSecurity: false`** in OpenAPI validator config - security is handled by custom middleware

### Vercel Serverless Limitations
- **In-memory storage resets** - `todoStore` data is lost between serverless invocations (need persistent storage for production)
- **No graceful shutdown** - `backend/src/server.ts` shutdown handlers don't apply in serverless
- **Cold starts** - First request after inactivity may take 1-2 seconds
- **250MB function size limit** - Unlikely to hit with this application
- **10-second max execution time** - Configurable in vercel.json (default shown)

### Deployment
- **Build order matters** - Backend must build before deployment (api/index.ts needs compiled code)
- **Environment variables** - Set in Vercel dashboard, not in .env files
- **CORS configuration** - Must include Vercel deployment URL in `CORS_ALLOWED_ORIGINS`

## Vercel Configuration (vercel.json)

The `vercel.json` file at the root configures:
- **Build command**: Compiles backend TypeScript
- **Install command**: Installs dependencies for both root and backend
- **Rewrites/Routes**: Maps `/api/v1/*` to the Express serverless function
- **Functions**: Configures memory (1024MB) and timeout (10s) for the API
- **Environment**: Sets NODE_ENV=production

## Testing

Backend tests are in `backend/tests/`:
- Run: `npm run test:backend`
- Coverage: `cd backend && npm run test:coverage`
- Watch mode: `cd backend && npm run test:watch`

Frontend tests will be configured when Angular is installed.

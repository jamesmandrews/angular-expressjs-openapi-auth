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
│   │   │   └── auth/           # Authentication controllers
│   │   ├── middleware/         # Auth, security, error handling
│   │   ├── auth/               # Pluggable auth providers
│   │   ├── db/                 # Database connection and schema
│   │   ├── email/              # Pluggable email providers
│   │   ├── models/             # Data models (userStore, tokenStore)
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Logger, password, JWT, shortId helpers
│   ├── openapi.yaml            # OpenAPI specification
│   ├── tests/                  # Jest tests
│   ├── package.json            # Backend dependencies
│   └── tsconfig.json           # Backend TypeScript config
├── rests/                      # REST Client test files
│   ├── auth.rest               # Authentication endpoint tests
│   └── .env.example            # Token storage template
├── src/                        # Angular 19 application (to be installed)
├── dist/                       # Build output
│   └── backend/                # Compiled Express code
├── docker-compose.yml          # PostgreSQL database container
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

### Database
- **Start PostgreSQL**: `docker-compose up -d` - Start PostgreSQL container
- **Stop PostgreSQL**: `docker-compose down` - Stop container (data persists)
- **Reset Database**: `docker-compose down -v` - Stop and delete all data

### Vercel Deployment
- **Build Command**: `npm run build:backend` (configured in vercel.json)
- **Install Command**: `npm install && cd backend && npm install`
- **API Routes**: All requests to `/api/v1/*` are routed to the Express serverless function

## Database

### PostgreSQL Setup

The application uses PostgreSQL for persistent storage. Run with Docker:

```bash
docker-compose up -d
```

Database configuration (see `backend/.env.example`):
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=authuser
POSTGRES_PASSWORD=authpass
POSTGRES_DB=authdb
```

### Schema

Tables are auto-created on server startup (`backend/src/db/schema.ts`):

- **users** - User accounts with email, password hash, profile info
- **password_reset_tokens** - Tokens for forgot-password flow
- **email_verification_tokens** - Tokens for email verification
- **token_blacklist** - Invalidated JWTs (for logout)

### User IDs

User IDs use **short IDs** (22-character base62 strings) instead of UUIDs:
- Example: `4jPYQW43CZfw7Lm7JLe5Hl`
- Same entropy as UUID v4 but more compact
- Generated via `backend/src/utils/shortId.ts`

## API Endpoints

### Authentication (`/api/v1/auth/*`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create new user account |
| POST | `/auth/login` | No | Login and get JWT token |
| POST | `/auth/logout` | Yes | Invalidate current token |
| POST | `/auth/refresh` | Yes | Get new token (if >50% expired) |
| GET | `/auth/me` | Yes | Get current user profile |
| PATCH | `/auth/me` | Yes | Update profile (firstName, lastName) |
| POST | `/auth/change-password` | Yes | Change password (requires current) |
| POST | `/auth/forgot-password` | No | Request password reset email |
| POST | `/auth/reset-password` | No | Reset password with token |
| POST | `/auth/verify-email` | No | Verify email with token |
| POST | `/auth/resend-verification` | Yes | Resend verification email |

### Health (`/api/v1/health`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Server health + database status |

## Authentication System

### JWT Authentication

The application uses JWT tokens for authentication:

1. **Login** returns an access token (default: 15 min expiry)
2. **Token refresh** only works after 50% of token lifetime has elapsed (configurable)
3. **Logout** adds token to blacklist (if `ENABLE_TOKEN_BLACKLIST=true`)

Configuration:
```bash
JWT_SECRET=your-secret-key
JWT_ACCESS_TOKEN_EXPIRY=900              # 15 minutes in seconds
JWT_REFRESH_THRESHOLD_PERCENT=50         # Only refresh after 50% elapsed
ENABLE_TOKEN_BLACKLIST=false             # Set true for strict logout
```

### Password Security

- Passwords hashed with bcrypt (configurable rounds via `BCRYPT_SALT_ROUNDS`)
- Minimum 8 characters, must contain uppercase, lowercase, and number
- Password reset tokens expire after 1 hour (configurable)

## Email System

### Pluggable Email Providers

Email providers are configured via `EMAIL_PROVIDER` environment variable:

```bash
EMAIL_PROVIDER=stub    # Logs emails to console (default, development)
EMAIL_PROVIDER=smtp    # Send real emails via SMTP
```

SMTP configuration:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com
```

### Email Features

- **Registration**: Sends verification email with token
- **Forgot Password**: Sends reset link with token
- **Resend Verification**: Authenticated users can request new verification email

## Architecture Overview

### Backend: OpenAPI-First Design

The backend is an OpenAPI-driven Express.js application using **automatic route registration** via `express-openapi-validator`'s `operationHandlers` feature.

**Route registration happens automatically** - routes are NOT manually defined in code:

1. **OpenAPI Spec is Source of Truth** (`backend/openapi.yaml`):
   - Each operation defines both `operationId` and `x-eov-operation-handler`
   - These must match the controller filename exactly
   - Example: `operationId: authLogin` → `x-eov-operation-handler: auth/login` → `backend/src/controllers/auth/login.ts`

2. **Controller Convention**:
   - Controllers in subdirectories use path format: `auth/login` → `controllers/auth/login.ts`
   - Must export a **default function** with signature: `(req: Request, res: Response, next: NextFunction) => Promise<void>`

3. **Validation is Automatic**:
   - All request validation happens via `express-openapi-validator` middleware
   - Validation rules come from OpenAPI schemas
   - No manual validation code needed in controllers

### Data Flow

```
Request → Vercel Edge Network / Local Server
        → Security middleware (Helmet, CORS, Rate limiting)
        → Request logger
        → Custom auth middleware (validates JWT, attaches req.user)
        → express-openapi-validator (validates against OpenAPI spec)
        → Auto-loaded controller (based on operationId)
        → PostgreSQL database (via models)
        → Response (logged with status/timing)
        → Error handler middleware (if error occurred)
```

### Error Response Structure

All errors follow the schema defined in `backend/openapi.yaml`:
```typescript
{
  error: {
    code: string,      // e.g., "VALIDATION_ERROR", "INVALID_CREDENTIALS"
    message: string,
    details?: Array<{ field: string, message: string }>
  }
}
```

## Testing Endpoints

Use VS Code REST Client extension with `rests/auth.rest`:

1. Copy `rests/.env.example` to `rests/.env`
2. Register a user and login
3. Copy tokens from responses to `rests/.env`:
   ```
   ACCESS_TOKEN=eyJhbGci...
   PASSWORD_RESET_TOKEN=abc123...
   EMAIL_VERIFICATION_TOKEN=def456...
   ```
4. Run requests that require authentication

## Adding New Backend Endpoints

1. **Add operation to `backend/openapi.yaml`**:
   - Define path, method, parameters, request/response schemas
   - Set `operationId` (e.g., `authUpdateProfile`)
   - Set `x-eov-operation-handler` (e.g., `auth/updateProfile`)

2. **Create controller file**: `backend/src/controllers/auth/updateProfile.ts`
   - Export default async function
   - Access validated data from `req.body`, `req.params`, `req.query`
   - Access authenticated user via `req.user`
   - Return responses matching OpenAPI schema

3. **Add model methods if needed**: Update `backend/src/models/userStore.ts`

4. **Restart server**: nodemon auto-restarts on file changes

## Important Constraints

### Backend
- **No manual route definitions** - adding routes in `backend/src/app.ts` will create conflicts
- **Controller filenames must exactly match** the `x-eov-operation-handler` value
- **Default exports required** - named exports won't be found by the validator
- **Authentication runs before validation** - auth middleware processes requests before OpenAPI validator
- **`validateSecurity: false`** in OpenAPI validator config - security is handled by custom middleware

### Database
- **PostgreSQL required** - run `docker-compose up -d` before starting the server
- **Schema auto-migrates** - tables created on startup if they don't exist
- **No down migrations** - manual intervention needed for schema changes to existing tables

### Security
- **Never commit `.env` files** - use `.env.example` as template
- **Use app passwords for Gmail SMTP** - regular passwords won't work
- **Tokens in `rests/.env` are gitignored** - safe to store for testing

## Configuration Reference

See `backend/.env.example` for all configuration options:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |
| `POSTGRES_*` | - | Database connection |
| `JWT_SECRET` | - | **Required** in production |
| `JWT_ACCESS_TOKEN_EXPIRY` | 900 | Token lifetime (seconds) |
| `JWT_REFRESH_THRESHOLD_PERCENT` | 50 | Refresh after this % elapsed |
| `BCRYPT_SALT_ROUNDS` | 10 | Password hashing rounds |
| `EMAIL_PROVIDER` | stub | Email provider (stub/smtp) |
| `CORS_ALLOWED_ORIGINS` | localhost | Comma-separated origins |
| `RATE_LIMIT_*` | - | Rate limiting config |

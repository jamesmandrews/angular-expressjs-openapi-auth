# Angular + Express.js Authentication System

An OpenAPI first full-stack authentication application with an Angular 19 frontend and Express.js OpenAPI backend. Features JWT authentication, two-factor authentication (TOTP), email verification, and role-based access control.  It is meant to be a boilerplate.  No one wants to write this stuff over and over and over again.  No one wants to tell AI to write thie stuff over and over and over again.  This is a good starting point and saves you a ton of work/tokens.

## Features

### Authentication
- User registration with email verification
- Login with JWT access tokens
- Token refresh mechanism
- Password reset via email
- Change password functionality

### Two-Factor Authentication (2FA)
- TOTP-based 2FA using authenticator apps (Google Authenticator, Authy, 1Password, etc.)
- QR code setup flow
- Backup codes for account recovery
- Enable/disable 2FA management

### Security
- **Secure token storage**: Access tokens in memory only, refresh tokens in HttpOnly cookies
- **Refresh token rotation**: Tokens rotate on each use with reuse detection
- **Hashed sensitive tokens**: Password reset and email verification tokens stored as SHA256 hashes
- Bcrypt password hashing
- JWT token blacklisting for logout
- Rate limiting
- Helmet.js security headers
- CORS configuration
- Role-based access control with scopes
- Logout all devices functionality

### User Management
- User profiles with first/last name
- Multiple user types (configurable)
- Audit logging for security events

## Tech Stack

### Frontend
- **Angular 19** with standalone components
- **Angular Signals** for reactive state management
- **RxJS** for HTTP operations
- TypeScript

### Backend
- **Express.js** with TypeScript
- **OpenAPI 3.0** specification-driven development
- **PostgreSQL** database
- **express-openapi-validator** for automatic routing and validation
- **nodemailer** for email delivery

## Prerequisites

- Node.js v18+
- Docker (for PostgreSQL)
- npm

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd angular-expressjs-openapi-auth

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

### 3. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at minimum:
```bash
JWT_SECRET=your-secure-secret-key
```

### 4. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start separately:
npm run dev:backend   # Express API on http://localhost:3000
npm run dev:frontend  # Angular app on http://localhost:4200
```

### 5. Access the Application

Open http://localhost:4200 in your browser.

## Project Structure

```
/
├── backend/                    # Express.js API
│   ├── src/
│   │   ├── controllers/        # OpenAPI operation handlers
│   │   │   └── auth/           # Authentication controllers
│   │   │       └── 2fa/        # Two-factor authentication
│   │   ├── middleware/         # Auth, security, error handling
│   │   ├── models/             # Data stores (user, token, etc.)
│   │   ├── db/                 # Database connection and schema
│   │   ├── email/              # Email providers (stub, SMTP)
│   │   ├── utils/              # JWT, password, TOTP utilities
│   │   └── types/              # TypeScript definitions
│   ├── openapi.yaml            # API specification
│   └── tests/                  # Jest tests
│
├── frontend/                   # Angular 19 application
│   ├── src/app/
│   │   ├── core/
│   │   │   ├── services/       # AuthService with signals
│   │   │   ├── guards/         # Route guards
│   │   │   └── interceptors/   # HTTP interceptors
│   │   ├── features/
│   │   │   ├── auth/           # Login, register, 2FA, email verify
│   │   │   ├── dashboard/      # Main dashboard
│   │   │   └── settings/       # Profile, password, 2FA management
│   │   └── shared/             # Shared components and models
│   └── proxy.conf.json         # Dev proxy to backend
│
├── docker-compose.yml          # PostgreSQL container
└── package.json                # Root workspace scripts
```

## Available Scripts

### Root Level
| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend |
| `npm run build` | Build both applications |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build:backend` | Build backend |
| `npm run build:frontend` | Build frontend |
| `npm run clean` | Remove build artifacts |

### Backend (`cd backend`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm test` | Run Jest tests |
| `npm run build` | Compile TypeScript |

### Database
| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start PostgreSQL |
| `docker-compose down` | Stop PostgreSQL |
| `docker-compose down -v` | Stop and delete all data |

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Create account |
| POST | `/api/v1/auth/login` | No | Login |
| POST | `/api/v1/auth/logout` | Yes | Logout |
| POST | `/api/v1/auth/logout-all` | Yes | Logout all devices |
| POST | `/api/v1/auth/refresh` | Cookie | Refresh token (uses HttpOnly cookie) |
| GET | `/api/v1/auth/me` | Yes | Get profile |
| PATCH | `/api/v1/auth/me` | Yes | Update profile |
| POST | `/api/v1/auth/change-password` | Yes | Change password |
| POST | `/api/v1/auth/forgot-password` | No | Request reset |
| POST | `/api/v1/auth/reset-password` | No | Reset password |
| POST | `/api/v1/auth/verify-email` | No | Verify email |
| POST | `/api/v1/auth/resend-verification` | Yes | Resend email |

### Two-Factor Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/2fa/setup` | Yes | Get QR code |
| POST | `/api/v1/auth/2fa/verify-setup` | Yes | Activate 2FA |
| POST | `/api/v1/auth/2fa/verify` | Partial | Verify during login |
| POST | `/api/v1/auth/2fa/disable` | Yes | Disable 2FA |
| POST | `/api/v1/auth/2fa/backup-codes/regenerate` | Yes | New backup codes |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Server and database status |

## Configuration

### Environment Variables

See `backend/.env.example` for all options. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `JWT_SECRET` | - | **Required** - Token signing key |
| `JWT_ACCESS_TOKEN_EXPIRY` | 300 | Access token lifetime (seconds) |
| `REFRESH_TOKEN_EXPIRY` | 86400 | Refresh token lifetime (24 hours) |
| `POSTGRES_*` | - | Database connection |
| `EMAIL_PROVIDER` | stub | Email provider (stub/smtp) |
| `TOTP_ISSUER` | MyApp | Name in authenticator apps |

### Email Configuration

**Development (default):** Emails are logged to console.

**Production SMTP:**
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com
```

## Frontend Routes

| Route | Description | Guard |
|-------|-------------|-------|
| `/login` | Login page | Guest only |
| `/register` | Registration | Guest only |
| `/verify-email` | Email verification | - |
| `/verify-email-pending` | Pending verification | Unverified users |
| `/2fa-verify` | 2FA code entry | 2FA pending |
| `/dashboard` | Main dashboard | Verified users |
| `/account/profile` | Profile settings | Verified users |
| `/account/password` | Change password | Verified users |
| `/account/2fa` | 2FA management | Verified users |

## Architecture Highlights

### OpenAPI-First Backend

Routes are automatically registered from `openapi.yaml`:

```yaml
paths:
  /auth/login:
    post:
      operationId: authLogin
      x-eov-operation-handler: auth/login
```

Controllers export a default function matching the handler path:
```typescript
// backend/src/controllers/auth/login.ts
export default async function login(req, res, next) { ... }
```

### Angular Signals

The frontend uses Angular Signals for reactive state:

```typescript
// AuthService
readonly currentUser = computed(() => this.currentUserSignal());
readonly isAuthenticated = computed(() => this.isAuthenticatedSignal());
```

### Route Guards

- `authGuard` - Requires authentication
- `guestGuard` - Requires unauthenticated
- `emailVerifiedGuard` - Requires verified email
- `twoFactorGuard` - Requires 2FA pending state

## Testing

### Backend Tests

```bash
cd backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### API Testing

Use the REST Client files in `rests/`:
1. Copy `rests/.env.example` to `rests/.env`
2. Open `.rest` files in VS Code with REST Client extension
3. Execute requests and copy tokens to `.env`

## License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.

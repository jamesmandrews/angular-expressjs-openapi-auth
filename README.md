# Angular + Express.js Authentication System

An OpenAPI first full-stack authentication application with an Angular 19 frontend and Express.js OpenAPI API. Features JWT authentication, two-factor authentication (TOTP), email verification, and role-based access control.  It is meant to be a boilerplate.  No one wants to write this stuff over and over and over again.  No one wants to tell AI to write thie stuff over and over and over again.  This is a good starting point and saves you a ton of work/tokens.

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

### Organizations (Optional)
- Create organizations during registration
- Invite-only membership with email invitations
- Role hierarchy: Owner > Admin > Member
- Single organization per user
- Configurable via environment flags:
  - `ORGANIZATIONS_ENABLED` - Enable optional org registration
  - `organizationsOnlyEnabled` - Force org registration for all users

### Plugin System
- Event-driven architecture with 18 hook points
- Sync plugins can block operations (e.g., block registration)
- Async plugins for notifications, logging, integrations
- Built-in plugins for audit logging and email notifications
- Easy enable/disable via config or file management

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

# Install API dependencies
cd api-authentication && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

### 3. Configure Environment

```bash
cp api-authentication/.env.example api-authentication/.env
```

Edit `api-authentication/.env` and set at minimum:
```bash
JWT_SECRET=your-secure-secret-key
```

**Generating a secure JWT_SECRET:**

```bash
# Option 1: Using openssl (recommended)
openssl rand -base64 64

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

Use a minimum of 256 bits (32 bytes) of entropy. The examples above generate 512 bits (64 bytes) for extra security.

### 4. Start Development Servers

```bash
# Start both frontend and API
npm run dev

# Or start separately:
npm run dev:api:auth   # Express API on http://localhost:3000
npm run dev:frontend   # Angular app on http://localhost:4200
```

### 5. Access the Application

Open http://localhost:4200 in your browser.

## Project Structure

```
/
├── api-authentication/         # Express.js Authentication API
│   ├── src/
│   │   ├── controllers/        # OpenAPI operation handlers
│   │   │   └── auth/           # Authentication controllers
│   │   │       └── 2fa/        # Two-factor authentication
│   │   ├── middleware/         # Auth, security, error handling
│   │   ├── models/             # Data stores (user, token, etc.)
│   │   ├── db/                 # Database connection and schema
│   │   ├── plugin-system/      # Plugin system core
│   │   ├── plugins/            # Plugin implementations
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
│   └── proxy.conf.json         # Dev proxy to API
│
├── docker-compose.yml          # PostgreSQL container
└── package.json                # Root workspace scripts
```

## Available Scripts

### Root Level
| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and API |
| `npm run build` | Build both applications |
| `npm run dev:api:auth` | Start auth API only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build:api:auth` | Build auth API |
| `npm run build:frontend` | Build frontend |
| `npm run test:api:auth` | Run auth API tests |
| `npm run clean` | Remove build artifacts |

### Auth API (`cd api-authentication`)
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

### Organizations (when enabled)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/org` | Yes | Get current organization |
| PATCH | `/api/v1/org` | Owner/Admin | Update organization name |
| POST | `/api/v1/org/invites` | Owner/Admin | Send member invitation |
| GET | `/api/v1/org/invites` | Owner/Admin | List pending invites |
| DELETE | `/api/v1/org/invites/:id` | Owner/Admin | Revoke invitation |
| POST | `/api/v1/org/invites/accept` | Yes | Accept invitation |
| GET | `/api/v1/org/members` | Yes | List organization members |
| PATCH | `/api/v1/org/members/:userId` | Owner/Admin | Update member role |
| DELETE | `/api/v1/org/members/:userId` | Owner/Admin | Remove member |
| POST | `/api/v1/org/leave` | Yes | Leave organization |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Server and database status |

## Configuration

### Environment Variables

See `api-authentication/.env.example` for all options. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `JWT_SECRET` | - | **Required** - Token signing key |
| `JWT_ACCESS_TOKEN_EXPIRY` | 300 | Access token lifetime (seconds) |
| `REFRESH_TOKEN_EXPIRY` | 86400 | Refresh token lifetime (24 hours) |
| `POSTGRES_*` | - | Database connection |
| `EMAIL_PROVIDER` | stub | Email provider (stub/smtp) |
| `TOTP_ISSUER` | MyApp | Name in authenticator apps |
| `DISABLED_PLUGINS` | - | Comma-separated plugin names to disable |
| `ORGANIZATIONS_ENABLED` | false | Enable organization feature |
| `ORG_INVITE_EXPIRY_HOURS` | 168 | Invite link expiration (7 days) |
| `ORG_INVITE_URL` | - | Frontend URL for invite acceptance |

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
| `/` | Home page | Guest only |
| `/login` | Login page | Guest only |
| `/register` | Registration | Guest only |
| `/register?type=organization` | Org registration | Guest only (if enabled) |
| `/verify-email` | Email verification | - |
| `/verify-email-pending` | Pending verification | Unverified users |
| `/2fa-verify` | 2FA code entry | 2FA pending |
| `/dashboard` | Main dashboard | Verified users |
| `/account/profile` | Profile settings | Verified users |
| `/account/password` | Change password | Verified users |
| `/account/2fa` | 2FA management | Verified users |

### Frontend Organization Configuration

Configure in `frontend/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: '/api/v1',
  organizationsEnabled: true,      // Show optional org registration
  organizationsOnlyEnabled: false, // Force org registration for all users
};
```

| Flag | Effect |
|------|--------|
| Both `false` | Individual accounts only |
| `organizationsEnabled: true` | Both individual and org options on home page |
| `organizationsOnlyEnabled: true` | Org required for all registrations |

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
// api-authentication/src/controllers/auth/login.ts
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

## Plugin System

The API features a powerful plugin system for extending functionality without modifying core code. Plugins can react to authentication events, block operations, send notifications, and more.

### Built-in Plugins

| Plugin | Mode | Description |
|--------|------|-------------|
| `audit-database` | async | Writes security events to the audit_logs table |
| `auth-emails` | async | Sends verification and password reset emails |
| `example-logger` | async | Logs all events to console (demo plugin) |

### Available Events

Plugins can subscribe to any of these 18 events:

**Auth Events:**
| Event | Description | Can Block |
|-------|-------------|-----------|
| `auth.register.before` | Before user is created | Yes |
| `auth.register` | After successful registration | No |
| `auth.login` | Successful login | No |
| `auth.login.failed` | Failed login attempt | No |
| `auth.logout` | User logged out | No |
| `auth.logout.all` | All sessions terminated | No |

**Password Events:**
| Event | Description | Can Block |
|-------|-------------|-----------|
| `auth.password.reset.request` | Password reset requested | No |
| `auth.password.reset` | Password was reset | No |
| `auth.password.change` | Password changed | No |

**Email Events:**
| Event | Description | Can Block |
|-------|-------------|-----------|
| `auth.email.verified` | Email verified | No |
| `auth.email.resend` | Verification email resent | No |

**2FA Events:**
| Event | Description | Can Block |
|-------|-------------|-----------|
| `auth.2fa.enabled` | 2FA activated | No |
| `auth.2fa.disabled` | 2FA deactivated | No |
| `auth.2fa.verify` | 2FA verification succeeded | No |
| `auth.2fa.verify.failed` | 2FA verification failed | No |
| `auth.2fa.backup.used` | Backup code used | No |
| `auth.2fa.backup.regenerated` | Backup codes regenerated | No |

**Profile Events:**
| Event | Description | Can Block |
|-------|-------------|-----------|
| `user.profile.updated` | Profile info changed | No |

**Organization Events:**
| Event | Description | Can Block |
|-------|-------------|-----------|
| `org.created` | Organization created | No |
| `org.updated` | Organization name changed | No |
| `org.member.invited` | Member invitation sent | No |
| `org.member.joined` | User accepted invitation | No |
| `org.member.updated` | Member role changed | No |
| `org.member.removed` | Member removed or left | No |

### Creating a Plugin

Create a file in `api-authentication/src/plugins/` with a default export:

```typescript
// api-authentication/src/plugins/my-plugin.ts
import { Plugin, PluginContext, PluginResult } from '../plugin-system/types';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  events: ['auth.register', 'auth.login'], // or '*' for all events
  mode: 'async', // 'async' = fire-and-forget, 'sync' = can block

  async handle(ctx: PluginContext): Promise<PluginResult> {
    console.log(`Event: ${ctx.event}`, {
      userId: ctx.userId,
      email: ctx.email,
      ip: ctx.ip,
      data: ctx.data,
    });

    return { success: true };
  },

  async onLoad() {
    console.log('Plugin loaded!');
  },
};

export default myPlugin;
```

### Blocking Events (Sync Plugins)

Sync plugins can block operations by returning `{ success: false }`:

```typescript
const registrationBlocker: Plugin = {
  name: 'registration-blocker',
  events: ['auth.register.before'],
  mode: 'sync', // Required for blocking
  priority: 10, // Lower = runs first (default: 100)

  async handle(ctx: PluginContext): Promise<PluginResult> {
    const email = ctx.data.email as string;

    // Block disposable email domains
    if (email.endsWith('@tempmail.com')) {
      return {
        success: false,
        error: 'Disposable email addresses are not allowed',
        data: { code: 'DISPOSABLE_EMAIL' },
      };
    }

    return { success: true };
  },
};
```

### Plugin Context

Every plugin handler receives a `PluginContext`:

```typescript
interface PluginContext {
  event: PluginEvent;      // Event name
  userId?: string;         // User ID (if available)
  email?: string;          // User email (if available)
  ip?: string;             // Client IP address
  userAgent?: string;      // Client user agent
  timestamp: Date;         // When the event occurred
  data: Record<string, unknown>; // Event-specific data
}
```

### Enabling/Disabling Plugins

**File-based:** Plugins auto-load from `api-authentication/src/plugins/`. To disable, rename or remove the file.

**Config-based:** Use the `DISABLED_PLUGINS` environment variable:

```bash
# Disable specific plugins by name
DISABLED_PLUGINS=example-logger,audit-database
```

## Testing

### API Tests

```bash
cd api-authentication
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

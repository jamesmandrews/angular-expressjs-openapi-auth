# Security Architecture

This document describes the security architecture, design decisions, and implementation details of the authentication system.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Token Architecture](#token-architecture)
4. [Token Invalidation](#token-invalidation)
5. [Cookie Security](#cookie-security)
6. [Password Security](#password-security)
7. [Two-Factor Authentication](#two-factor-authentication)
8. [Rate Limiting](#rate-limiting)
9. [Audit Logging](#audit-logging)
10. [Security Headers](#security-headers)
11. [Known Limitations](#known-limitations)

---

## Overview

The authentication system implements a secure, stateless JWT-based authentication with the following key security properties:

- **Access tokens** stored in memory only (never persisted to localStorage)
- **Refresh tokens** stored in HttpOnly cookies with rotation on every use
- **Instant token invalidation** via per-user token salt without requiring a blacklist
- **Two-factor authentication** using TOTP with backup codes
- **Hashed sensitive tokens** (password reset, email verification) using SHA-256

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                           │
│  • Access token in memory only                                  │
│  • Refresh token in HttpOnly cookie (not accessible via JS)     │
│  • User profile in localStorage (non-sensitive data only)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Security Middleware                         │
│  • Helmet.js security headers                                   │
│  • CORS with explicit origin allowlist                          │
│  • Rate limiting per endpoint                                   │
│  • Request logging                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Authentication Layer                          │
│  • JWT signature verification                                   │
│  • Token salt validation (instant invalidation)                 │
│  • User existence check                                         │
│  • 2FA state enforcement                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  • Bcrypt password hashing                                      │
│  • SHA-256 token hashing                                        │
│  • Parameterized queries (SQL injection prevention)             │
│  • Audit logging                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Login Flow (Without 2FA)

```
1. Client sends email + password to POST /auth/login
2. Server validates credentials against bcrypt hash
3. Server generates:
   - Access token (JWT with jti = user's token_salt)
   - Refresh token (random, hashed before storage)
4. Server sets refresh token in HttpOnly cookie
5. Server returns access token in response body
6. Client stores access token in memory only
```

### Login Flow (With 2FA)

```
1. Client sends email + password to POST /auth/login
2. Server validates credentials
3. Server generates partial access token (twoFactorPending: true, 5 min expiry)
4. Client prompts for TOTP code
5. Client sends code to POST /auth/2fa/verify
6. Server validates TOTP or backup code
7. Server generates full access token + refresh token
8. Server sets refresh token in HttpOnly cookie
9. Server returns access token in response body
```

### Token Refresh Flow

```
1. Frontend detects access token expiring (proactive refresh at 50% lifetime)
2. Browser automatically sends refresh token cookie to POST /auth/refresh
3. Server validates refresh token:
   - Verifies hash exists in database
   - Checks not expired or revoked
   - Detects reuse (if token already rotated, revoke entire family)
4. Server rotates refresh token:
   - Marks old token as replaced
   - Creates new token in same family
5. Server generates new access token with current token_salt
6. Server sets new refresh token cookie
7. Server returns new access token
```

### Logout Flow

```
1. Client calls POST /auth/logout (always, regardless of token state)
2. Server revokes refresh token in database
3. Server clears refresh token cookie
4. Client clears access token from memory
5. Client redirects to login
```

---

## Token Architecture

### Access Token (JWT)

| Property | Value |
|----------|-------|
| Storage | Memory only (never localStorage) |
| Lifetime | 5 minutes (configurable via `JWT_ACCESS_TOKEN_EXPIRY`) |
| Format | JWT (HS256) |

**Payload Claims:**

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "roles": ["user"],
  "scopes": ["profile:read", "profile:write"],
  "jti": "22-char-token-salt",
  "twoFactorVerified": true,
  "iat": 1702700000,
  "exp": 1702700300
}
```

The `jti` (JWT ID) claim contains the user's current `token_salt`, enabling instant invalidation without a blacklist.

### Refresh Token

| Property | Value |
|----------|-------|
| Storage | HttpOnly cookie + hashed in database |
| Lifetime | 24 hours (configurable via `REFRESH_TOKEN_EXPIRY`) |
| Format | 64-character hex string (32 bytes random) |

**Database Schema:**

```sql
CREATE TABLE refresh_tokens (
  id VARCHAR(22) PRIMARY KEY,
  user_id VARCHAR(22) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash
  family_id VARCHAR(22) NOT NULL,           -- For rotation tracking
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  replaced_by VARCHAR(22),                  -- Next token in chain
  user_agent VARCHAR(500),
  ip_address INET
);
```

### Token Rotation & Reuse Detection

Refresh tokens implement **rotation with reuse detection**:

1. Each login creates a new **token family** (unique `family_id`)
2. On refresh, the old token is marked `replaced_by` the new token
3. If a rotated token is reused (already has `replaced_by` set):
   - This indicates potential token theft
   - The **entire token family is revoked**
   - User must re-authenticate

This protects against scenarios where an attacker steals a refresh token - if both the attacker and legitimate user try to use it, the reuse is detected.

---

## Token Invalidation

### The Problem

JWTs are stateless - once issued, they're valid until expiry. Traditional solutions:

1. **Short expiry** - Limits damage window but poor UX (frequent re-auth)
2. **Token blacklist** - Requires database check on every request, blacklist grows unbounded

### Our Solution: Token Salt

Each user has a `token_salt` column (22-character random string) that is:

1. Included in JWTs as the `jti` claim
2. Validated on every authenticated request
3. Regenerated on security events (logout-all, password change)

**Implementation:**

```typescript
// During JWT validation (jwtAuth.ts)
const user = await userStore.getById(decoded.sub);

if (decoded.jti && user.tokenSalt && decoded.jti !== user.tokenSalt) {
  return { authenticated: false, error: 'Token has been invalidated' };
}
```

**When salt is regenerated:**

- `POST /auth/logout-all` - Invalidates all sessions
- `POST /auth/change-password` - Forces re-authentication everywhere

**Benefits:**

- Instant invalidation (no waiting for token expiry)
- No blacklist table growth
- Single database column per user
- Works across distributed systems (salt is authoritative)

**Trade-off:**

- Requires database lookup on every authenticated request
- However, this lookup already happens to verify user existence and fetch `emailVerified` status

---

## Cookie Security

### Refresh Token Cookie

```typescript
res.cookie('refresh_token', token, {
  httpOnly: true,        // Not accessible via JavaScript
  secure: true,          // HTTPS only (in production)
  sameSite: 'strict',    // Prevents CSRF (production) / 'lax' (development)
  path: '/api/v1',       // Only sent to API endpoints
  maxAge: 86400000       // 24 hours
});
```

| Attribute | Purpose |
|-----------|---------|
| `httpOnly` | Prevents XSS attacks from reading the token |
| `secure` | Ensures cookie only sent over HTTPS |
| `sameSite: strict` | Prevents CSRF by not sending cookie on cross-origin requests |
| `path: /api/v1` | Limits cookie scope to API endpoints |

### Development vs Production

In development (localhost), some cookie attributes are relaxed:

- `secure: false` - Allow HTTP for local development
- `sameSite: 'lax'` - Allow cookie with same-site navigations (needed for proxy)

---

## Password Security

### Hashing

Passwords are hashed using **bcrypt** with configurable rounds:

```typescript
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
const hash = await bcrypt.hash(password, SALT_ROUNDS);
```

Default: 10 rounds (~100ms on modern hardware)

### Validation Rules

Passwords must meet these requirements:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Password Reset Tokens

Password reset tokens are:

1. Generated as 32-byte random hex strings
2. **Hashed with SHA-256 before storage** (raw token sent to user)
3. Single-use (marked as used after reset)
4. Expire after 1 hour

```typescript
// Token creation
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
// Store tokenHash, send rawToken to user
```

This ensures that even if the database is compromised, attackers cannot use the stored hashes to reset passwords.

---

## Two-Factor Authentication

### TOTP Implementation

- Algorithm: SHA-1 (standard for Google Authenticator compatibility)
- Period: 30 seconds
- Digits: 6
- Window: ±1 time step (allows for clock drift)

### Setup Flow

1. User requests 2FA setup (`POST /auth/2fa/setup`)
2. Server generates TOTP secret and stores (unverified)
3. Server returns secret + QR code data URL
4. User scans QR code with authenticator app
5. User submits verification code (`POST /auth/2fa/verify-setup`)
6. Server validates code and marks 2FA as enabled
7. Server generates and returns backup codes

### Backup Codes

- 10 codes generated on 2FA setup
- Each code is 8 characters (alphanumeric)
- Codes are **hashed with bcrypt** before storage
- Single-use (marked as used after verification)
- Can be regenerated (invalidates old codes)

### Login with 2FA

When 2FA is enabled, login returns a **partial token** with:

```json
{
  "twoFactorPending": true,
  "exp": 300  // 5 minutes to complete verification
}
```

This token can ONLY be used to call `/auth/2fa/verify`. All other endpoints reject it.

---

## Rate Limiting

Rate limits are configured per-endpoint in the OpenAPI spec:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/register` | 5 requests | 15 minutes |
| `POST /auth/login` | 100 requests | 15 minutes |
| `POST /auth/forgot-password` | 3 requests | 1 hour |
| `POST /auth/reset-password` | 5 requests | 15 minutes |
| `POST /auth/2fa/verify` | 5 requests | 15 minutes |
| Global (all endpoints) | 100 requests | 15 minutes |

Limits are per-IP address using `express-rate-limit`.

---

## Audit Logging

Security-relevant events are logged to the `audit_logs` table:

| Event | Logged Data |
|-------|-------------|
| `auth.login` | User ID, email, success/failure, failure reason |
| `auth.logout` | User ID |
| `auth.register` | User ID, email, user type |
| `auth.password_change` | User ID |
| `auth.password_reset` | User ID |
| `auth.2fa_setup` | User ID |
| `auth.2fa_verify` | User ID, method (totp/backup), success/failure |
| `auth.backup_code_used` | User ID, remaining codes |

All logs include:
- Timestamp
- IP address
- User agent
- Request details (sanitized)

Logs are retained for 90 days (configurable via `AUDIT_LOG_RETENTION_DAYS`).

---

## Security Headers

Helmet.js is configured with these headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter (legacy browsers) |
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `Content-Security-Policy` | Default restrictive policy | Prevent XSS, injection |

---

## Known Limitations

### 1. localStorage for User Profile

The user profile (name, email, roles) is cached in `localStorage` for UX (faster page loads). This data is readable by any JavaScript on the page.

**Mitigation:** Profile data contains no secrets. Access tokens are never stored in localStorage.

**Alternative (not implemented):** Use encrypted IndexedDB or in-memory only storage.

### 2. No Refresh Token Binding

Refresh tokens are not bound to a specific device fingerprint or TLS channel.

**Mitigation:**
- Tokens are rotated on every use
- Reuse detection revokes entire family
- IP and User-Agent are logged for forensics

### 3. JWT Algorithm Hardcoded

The JWT algorithm (HS256) is hardcoded, not configurable.

**Mitigation:** HS256 with a strong secret is secure for single-issuer systems.

### 4. No Account Lockout

Failed login attempts are rate-limited but accounts are not locked after N failures.

**Consideration:** Implement progressive delays or account lockout for targeted attacks.

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (required) | HMAC secret for JWT signing |
| `JWT_ACCESS_TOKEN_EXPIRY` | 300 | Access token lifetime in seconds |
| `REFRESH_TOKEN_EXPIRY` | 86400 | Refresh token lifetime in seconds |
| `BCRYPT_SALT_ROUNDS` | 10 | Bcrypt hashing rounds |
| `ENABLE_TOKEN_BLACKLIST` | false | Enable JWT blacklist (optional, deprecated) |
| `AUDIT_LOG_ENABLED` | true | Enable audit logging |
| `AUDIT_LOG_RETENTION_DAYS` | 90 | Days to retain audit logs |

---

## Security Checklist

- [x] Passwords hashed with bcrypt
- [x] Sensitive tokens hashed before storage
- [x] Access tokens in memory only
- [x] Refresh tokens in HttpOnly cookies
- [x] Token rotation with reuse detection
- [x] Instant token invalidation (token salt)
- [x] Two-factor authentication (TOTP + backup codes)
- [x] Rate limiting on sensitive endpoints
- [x] Audit logging for security events
- [x] Security headers (Helmet.js)
- [x] CORS with explicit allowlist
- [x] Parameterized SQL queries
- [x] Input validation via OpenAPI schema

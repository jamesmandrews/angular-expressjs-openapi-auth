# Security & Bug Analysis

## Approach
- Re-reviewed the refreshed authentication stack (backend controllers, token stores, SPA auth service/interceptor) to verify what changed since the prior report.
- Confirmed dependency health by running `npm audit` at the repo root plus inside `backend/` and `frontend/` on 2025-12-16 (all three returned 0 known vulnerabilities).

## Notable Improvements
- Password-reset and email-verification tokens are now hashed before persistence (`backend/src/models/tokenStore.ts:1-223`).
- Refresh tokens live in `refresh_tokens`, rotate on every use, and are delivered exclusively via `HttpOnly` cookies with SameSite/secure flags (`backend/src/models/refreshTokenStore.ts`, `backend/src/utils/cookies.ts`).
- The SPA keeps access tokens in memory only; only the user profile is cached in `localStorage` (`frontend/src/app/core/services/auth.service.ts`).

## Current Findings
1. ~~**Logout can leave the refresh token cookie active**~~ **FIXED** - The SPA now always calls `/auth/logout` endpoint regardless of access token state, ensuring the server clears the refresh cookie.
2. ~~**Access tokens remain usable after "logout all" or password change**~~ **FIXED** - Implemented per-user `token_salt` (random 22-char string stored in users table). The salt is included in JWT claims as `jti`. On logout-all or password change, the salt is regenerated, instantly invalidating all existing access tokens. JWT validation compares the token's `jti` against the user's current `token_salt`.
3. **User profile data still lives in `localStorage`** (`frontend/src/app/core/services/auth.service.ts:380-410`). Caching the full user object there speeds up reloads, but `localStorage` is readable by any JavaScript that runs in the page: a compromised dependency, a malicious extension, or an injected `<script>` can call `localStorage.getItem('user')` and exfiltrate names, email, roles, and 2FA flags. It also persists across browser restarts and shared machines until the app explicitly clears it. To keep the UX benefits without exposing PII, prefer in-memory stores, encrypted/signed IndexedDB, or another storage layer that isn't trivially readable by arbitrary scripts. **Accepted risk** - Profile data contains no secrets, and the UX benefit outweighs the low risk.

## npm audit Summary (2025-12-16)
| Location | Command | Result |
| --- | --- | --- |
| repo root | `npm audit` | 0 vulnerabilities (226 prod / 449 dev dependencies) |
| `backend/` | `npm audit` | 0 vulnerabilities (same dependency graph as root workspace) |
| `frontend/` | `npm audit` | 0 vulnerabilities (12 prod / 1,047 dev dependencies) |

## Recommended Next Steps
- ~~Update the SPA logout flow to always hit `/auth/logout`~~ **DONE**
- ~~Turn on token blacklisting~~ **DONE** - Replaced with token salt approach for instant invalidation without needing a blacklist table
- Consider CSP hardening to further mitigate XSS data access (optional enhancement)

# Repository Guidelines

## Project Structure & Module Organization
Root scripts live beside `package.json`, while implementation stays in `backend/` (Express/OpenAPI + Jest under `backend/tests/`) and `frontend/` (Angular 19 app under `frontend/src/app`). The database schema, connection helpers, and utilities are grouped under `backend/src/db/` and `backend/src/utils/`. Frontend features follow Angular's domain folders (`core`, `features/auth`, `features/dashboard`, etc.), and REST Client examples are kept in `rests/` for manual API checks. Build outputs land in `dist/`; never edit files there directly.

## Build, Test, and Development Commands
- `npm run dev` — concurrently serve Angular at `http://localhost:4200` and the API at `http://localhost:3000`.
- `npm run build` — produce production bundles for both layers (calls `build:backend` and `build:frontend`).
- `cd backend && npm run dev` — nodemon + ts-node server with OpenAPI-driven routing.
- `cd frontend && npm start` — Angular CLI dev server proxying to `/api` via `proxy.conf.json`.
- `docker-compose up -d` — bring up the PostgreSQL dependency; shut down with `docker-compose down` when finished.

## Coding Style & Naming Conventions
TypeScript is the default throughout; use 2-space indentation (see `backend/src/server.ts`). Name controllers and handlers to match their OpenAPI `operationId`/path (e.g., `controllers/auth/login.ts`). Prefer PascalCase for classes, camelCase for functions and signal/store variables (`currentUserSignal`), and CONSTANT_CASE for env-driven config. Keep imports sorted by module path and group related logic into small, pure helpers. Run Angular and backend formatters (`ng lint` if added, `tsc --noEmit`) before pushing.

## Testing Guidelines
Backend tests run with Jest: `cd backend && npm test` for the suite, `npm run test:watch` during development, and `npm run test:coverage` before releases (target ≥80% statements). Frontend uses Karma/Jasmine via `cd frontend && npm test`; co-locate specs next to components (`*.spec.ts`). For manual API checks, copy `rests/.env.example` to `rests/.env` and execute the `.rest` files in VS Code's REST Client so recorded requests stay reproducible.

## Commit & Pull Request Guidelines
Commits mirror the existing imperative style (`Update README and CLAUDE.md documentation`); keep subjects under ~72 characters and focus on one logical change. Every PR should describe scope, note affected endpoints or UI routes, and list validation steps (tests run, REST scenarios, screenshots for UI tweaks). Link to relevant issues, include env/setup notes for reviewers, and ensure new configuration keys are documented in `backend/.env.example` and `README.md` before requesting review.

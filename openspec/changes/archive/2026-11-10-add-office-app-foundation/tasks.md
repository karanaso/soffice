# Tasks

## 1. Project scaffold and configuration

- [x] 1.1 Initialize a Next.js App Router project with TypeScript, React, CSS Modules support, and npm scripts for `dev`, `build`, `start`, `lint`, `test`, and `test:e2e`; verify `npm run build` succeeds on the empty app.
- [x] 1.2 Add the runtime dependencies (`better-sqlite3`, `pg`, `zod`) and the test tooling (Vitest, Testing Library, Playwright); verify `npm install` and `npx playwright install --with-deps chromium` complete.
- [x] 1.3 Implement the Zod-validated configuration module for `DATABASE_BACKEND`, `DATABASE_URL`, `DATABASE_PATH`, and `PORT`, including backend inference and credential-safe error messages; verify unit tests cover defaults, explicit Postgres, contradictory settings, and redaction.
- [x] 1.4 Add shared design tokens and base global styles, and document local setup plus environment variables in `README.md`; verify the README commands run as written from a clean checkout.

## 2. Storage layer

- [x] 2.1 Add numbered SQLite and PostgreSQL migrations for `documents` and `schema_migrations`, including `name_key` uniqueness and type checks; verify both migration sets apply cleanly to empty databases.
- [x] 2.2 Implement the migration runner with per-dialect transactions, duplicate-safe re-runs, failure propagation, and a PostgreSQL advisory lock; verify tests cover first run, repeat run, and a deliberately failing migration.
- [x] 2.3 Implement name trimming, length validation, NFKC normalization, and lower-cased `name_key` in a shared module; verify unit tests cover case folding, whitespace, and the 120-character boundary.
- [x] 2.4 Implement the `DocumentRepository` interface and the SQLite adapter (list newest first, get, create, rename, delete, timestamp updates); verify the SQLite contract suite passes.
- [x] 2.5 Implement the PostgreSQL adapter with the same interface and PostgreSQL unique-violation translation; verify the PostgreSQL contract suite passes against a docker-compose database.
- [x] 2.6 Add the shared repository contract suite that runs both adapters against identical scenarios, including ordering, persistence after reconnect, and concurrent duplicate names; verify `npm test -- repository` passes with both backends available.

## 3. Document API and startup

- [x] 3.1 Wire migrations into the Next.js instrumentation startup hook so the server does not accept requests before migrations finish; verify a startup test observes a migrated database and a failing migration aborts startup.
- [x] 3.2 Implement `GET/POST /api/documents` with validation, default-name generation, and domain error mapping; verify API tests cover listing order, valid creation, blank-name creation, and storage failure.
- [x] 3.3 Implement `GET/PATCH/DELETE /api/documents/[id]` with 400/404/409 responses, and ensure rename updates `updated_at`; verify API tests cover success, not found, invalid name, and name conflict.
- [x] 3.4 Implement `GET /api/health` with a `SELECT 1` probe, 200/503 status, backend name, and redacted failure reason; verify tests cover healthy SQLite, healthy Postgres, and an unreachable database.

## 4. App shell and navigation

- [x] 4.1 Build the root layout with the Library, Word, Excel, PowerPoint, and Drawing tabs, active-tab styling, page titles, and horizontal scrolling at 360px; verify component tests assert active state, labels, and all tabs remaining reachable.
- [x] 4.2 Add the `/`, `/word`, `/excel`, `/powerpoint`, and `/drawing` routes and the document routes, including the type-mismatch redirect and not-found state; verify route tests cover each path and redirect behavior.
- [x] 4.3 Implement per-type session restoration of the last active document and address updates when tabs change; verify tests cover switching away and back, direct address load, and a stale stored id.
- [x] 4.4 Document navigation and URL structure in `README.md`; verify the documented paths match the implemented routes.

## 5. File library

- [x] 5.1 Build the dashboard list with name, type label, last-modified time, newest-first ordering, and loading, empty, and error/retry states; verify component tests cover each state and ordering.
- [x] 5.2 Implement the create dialog with type selection and optional name, persisting through the API and opening the new document; verify tests cover named creation, default naming, and failed creation keeping the dialog open.
- [x] 5.3 Implement inline rename with trimming, length feedback, conflict messaging, and updates to open shells; verify tests cover success, duplicate name, invalid name, and shell title refresh.
- [x] 5.4 Implement delete with a confirmation naming the document and close the workspace when the deleted document is open; verify tests cover confirm, cancel, and deleting the open document.
- [x] 5.5 Document the library workflows in `README.md`; verify the described create/rename/delete steps work against a running dev server.

## 6. Editor shells

- [x] 6.1 Build the shared shell frame with document name, type label, loading state, recoverable error with retry and Library actions, and the read-only notice; verify component tests cover loading, error, retry, and notice text.
- [x] 6.2 Add the type-specific placeholder surfaces (Word page, Excel grid, PowerPoint slide/canvas, Drawing canvas) with no content-editing or save controls; verify tests assert the correct surface per type and the absence of editing controls.
- [x] 6.3 Update shell titles when a rename occurs without a reload and return to the library without removing the document; verify tests cover rename propagation and library return.
- [x] 6.4 Document the read-only scope and planned editor changes in `README.md`; verify the README lists all four follow-up editor changes.

## 7. Integration verification

- [x] 7.1 Add Playwright end-to-end tests for create, rename, delete, open, reload, tab switching, and read-only shell behavior; verify `npm run test:e2e` passes against SQLite.
- [x] 7.2 Run the same end-to-end suite against PostgreSQL using the docker-compose service; verify all scenarios pass without application code changes.
- [x] 7.3 Add a production container and docker-compose examples for SQLite with a persistent volume and for PostgreSQL, and document them in `README.md`; verify `docker compose up` serves the dashboard and a healthy endpoint.
- [x] 7.4 Check the dashboard and all four shells at 360px and 1280px widths for reachable tabs, readable labels, and no horizontal page overflow; record the result in the change.
- [x] 7.5 Run `npm run lint`, `npm test`, `npm run build`, and `openspec validate add-office-app-foundation --strict`; verify all pass.

## Verification notes

Verified on 2026-11-10:

- `npm test`: 89 passed, 1 skipped (PostgreSQL suite skipped without `TEST_POSTGRES_URL`). With a live PostgreSQL service: 100 passed.
- `npm run test:e2e`: 7/7 passed against SQLite and 7/7 against PostgreSQL, covering create, default naming, rename, delete, open, reload, tab restoration, type-mismatch redirects, read-only shells, health, and responsive checks.
- Responsive check: dashboard and all four shells at 360×800 and 1280×900 have all five tabs reachable, readable labels, and no page-level horizontal overflow.
- Docker: `docker compose up --build -d` served the dashboard and a healthy SQLite endpoint; data survived a container restart. `docker compose -f docker-compose.postgres.yml up --build -d` reported a healthy PostgreSQL backend and also survived an app restart.
- `npm run lint`, `npm run build`, and `openspec validate add-office-app-foundation --strict` all pass.

## Workflow follow-up

- Review the implementation against each spec scenario before archiving.
- Archive `add-office-app-foundation` after the project's review requirements are satisfied, then verify the archived specs appear under `openspec/specs/`.

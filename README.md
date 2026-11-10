# soffice

A small, self-hostable office suite for schools. The first release provides a
shared document dashboard, a persistent tabbed workspace, read-only shells for
Word, Excel, PowerPoint, and Drawing, and storage on either SQLite or
PostgreSQL.

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- Docker (optional, for PostgreSQL and container deployment)

The SQLite driver ships prebuilt binaries. If your platform has no prebuilt
binary, install a C++ toolchain and Python before running `npm install`.

## Local setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The default database is a SQLite file at
`./data/soffice.db`; it is created automatically on first start.

Production build:

```bash
npm run build
npm start
```

## Configuration

Configuration comes from environment variables and is validated at startup.
Invalid settings stop the server with an error that names the setting and never
prints credentials.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_BACKEND` | inferred | `sqlite` or `postgres`. Inferred from `DATABASE_URL` when omitted. |
| `DATABASE_PATH` | `./data/soffice.db` | SQLite database file. The directory is created if missing. |
| `DATABASE_URL` | none | PostgreSQL connection URL. Required for the PostgreSQL backend. |
| `PORT` | `3000` | HTTP port. |

SQLite (default):

```bash
DATABASE_PATH=/var/lib/soffice/school.db npm start
```

PostgreSQL:

```bash
DATABASE_URL=postgres://soffice:soffice@localhost:5432/soffice npm start
```

Copy `.env.example` to `.env.local` for local development. Schema migrations run
automatically before the server accepts requests.

## Navigation

| Address | Screen |
| --- | --- |
| `/` | Library dashboard |
| `/word` | Word workspace (last document or empty state) |
| `/excel` | Excel workspace |
| `/powerpoint` | PowerPoint workspace |
| `/drawing` | Drawing workspace |
| `/<type>/<document-id>` | A document shell in its workspace |

Opening a document updates the address, so a reload or bookmark restores the
same tab and document. A document address opened under the wrong type redirects
to the correct workspace.

## Using the library

1. Select **New document**, choose a type, optionally enter a name, and confirm.
   Leaving the name blank generates a default name such as
   “Untitled Word document”.
2. Select a document to open it. Each workspace tab keeps one active document;
   opening another document of the same type replaces it in that tab.
3. Use **Rename** on a dashboard row or in an open document. Names are trimmed,
   limited to 120 characters, and unique regardless of letter case.
4. Use **Delete** on a row or in an open document and confirm. Deleting the open
   document returns you to the Library.

## Docker deployment

SQLite with a persistent volume (recommended for one school server):

```bash
docker compose up --build -d
```

The database is stored in the `soffice-data` volume and survives container
recreation. Open <http://localhost:3000>.

PostgreSQL with a managed database container:

```bash
docker compose -f docker-compose.postgres.yml up --build -d
```

Change `POSTGRES_PASSWORD` and the password in `DATABASE_URL` before using the
PostgreSQL example outside a local trial. The app applies migrations on startup
and waits for PostgreSQL to become healthy.

Both examples expose the health endpoint at
<http://localhost:3000/api/health> and include a container health check. To use
an external PostgreSQL service, omit the `db` service and set `DATABASE_URL` on
the app.

## Current scope

This release is intentionally read-only. Every document shell explains that
editing tools are not available yet and offers no way to edit or save document
content. The follow-up changes are:

- `add-word-editor` — rich-text editing and content persistence
- `add-spreadsheet-editor` — cell grid, formulas, and content persistence
- `add-slide-editor` — slide list, canvas, and content persistence
- `add-drawing-editor` — freehand drawing tools and content persistence

Accounts, sharing, and Microsoft Office import/export are deferred to later
changes.

## Testing

```bash
npm test             # unit, component, and repository tests
npm run test:e2e     # Playwright end-to-end tests (SQLite)
npm run lint
npm run build
```

The repository contract suite also runs against PostgreSQL when
`TEST_POSTGRES_URL` is set:

```bash
TEST_POSTGRES_URL=postgres://soffice:soffice@localhost:5432/soffice npm test
```

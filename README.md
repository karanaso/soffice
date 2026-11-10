# soffice

A small, self-hostable office suite for schools. It provides a shared document
dashboard, a persistent tabbed workspace, first-draft editors for Word, Excel,
PowerPoint, and Drawing, and storage on either SQLite or PostgreSQL.

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
5. Edit the document in its workspace. Changes save automatically after a short
   idle period; the header shows **Saved**, **Unsaved changes**, **Saving…**, or
   **Save failed** with a retry action. Leaving the page flushes pending changes.

## Editors

- **Word** — page editing with headings, bold/italic/underline, bulleted and
  numbered lists, undo/redo, and plain-text paste.
- **Excel** — a 26×100 cell grid with keyboard navigation, a formula bar,
  arithmetic formulas with cell references and `SUM`, recalculation, and
  undo/redo.
- **PowerPoint** — an ordered slide list with add/delete/reorder and a 16:9
  canvas for draggable text boxes.
- **Drawing** — freehand pen and eraser tools, colors, stroke widths,
  undo/redo, and a confirmable clear action.

Editor content is stored as validated JSON in the `document_contents` table and
is capped at 1 MiB per document. Content is loaded and saved through
`/api/documents/<id>/content`; edits use a revision check so two tabs cannot
silently overwrite each other.

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

This release ships first-draft editors with content persistence, not full
desktop-suite parity. The current editors cover the core writing, calculation,
slide, and drawing flows listed above. Deferred work includes richer formatting,
multi-sheet workbooks, slide layouts and transitions, shape libraries,
comments, printing/PDF export, and Microsoft Office import/export.

Accounts, sharing, and document import/export remain follow-up changes.

## Parallel editor agents

Five OpenCode agents are available for editor and platform work:

- `word-dev` — Word editor
- `excel-dev` — Excel editor
- `powerpoint-dev` — PowerPoint editor
- `drawing-dev` — Drawing editor
- `shared-dev` — shared shell, storage, API, migrations, dependencies, and integration

Each agent has its own ownership boundary and can work in a dedicated worktree.
See [`docs/parallel-agents.md`](docs/parallel-agents.md) for the ownership
table, worktree workflow, and shared-change handoff.

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

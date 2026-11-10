# Proposal

## Why

Schools need a simple, self-hostable place where students and staff can find their documents and open a word processor, spreadsheet, slide deck, or drawing without installing desktop software. The project is currently an empty repository, so the first step is a small, dependable foundation: a file dashboard, tabbed workspace, and storage that runs on either SQLite (single school server) or PostgreSQL (shared or hosted deployment).

## What Changes

- Add a file dashboard that lists every document with its type, name, and last-modified time, and supports creating, renaming, opening, and deleting files.
- Add a persistent tab shell for the four workspaces: Word, Excel, PowerPoint, and Drawing. Tabs are deep-linkable and can open a file selected in the dashboard.
- Add storage behind one repository interface with two interchangeable backends: SQLite by default and PostgreSQL when configured. Schema migrations run automatically on startup.
- Add editor shells for each document type: a file-bound workspace with title, save-state indicator, type-appropriate placeholder surface, and a clear "editing tools coming soon" state. No document content editing is included in this change.
- Establish the web app skeleton (routing, layout, error/empty states, health endpoint) that later editor changes build on.
- Document the planned follow-up feature changes so each editor can ship independently.

**Out of scope for this change:** authentication and user accounts, sharing and permissions, real document editing, file import/export to Microsoft formats, real-time collaboration, and mobile-native apps.

### Planned follow-up changes

The app is intentionally split so each capability can be delivered and reviewed on its own:

1. `add-word-editor` — rich-text editing and content persistence.
2. `add-spreadsheet-editor` — cell grid, formulas, and content persistence.
3. `add-slide-editor` — slide list, canvas, and content persistence.
4. `add-drawing-editor` — freehand drawing tools and content persistence.
5. `add-school-accounts` — sign-in, roles, and per-user file ownership.
6. `add-document-sharing` — sharing links and class/group access.
7. `add-office-file-import-export` — DOCX/XLSX/PPTX import and export.

These are not part of this change and will each get their own proposal, specs, design, and tasks.

## Capabilities

### New Capabilities

- `file-library`: dashboard behavior for listing, creating, renaming, opening, and deleting typed documents, including empty/error states and conflict handling.
- `workspace-navigation`: the persistent tabbed workspace shell, deep links to documents, and how a selected file becomes the active workspace.
- `data-persistence`: the storage contract, backend selection between SQLite and PostgreSQL, migrations, and startup health reporting.
- `editor-shells`: the file-bound shell shown for Word, Excel, PowerPoint, and Drawing documents, including type identification, save-state display, and the not-yet-editable state.

### Modified Capabilities

None. The project has no existing specs.

## Impact

- **New application:** a TypeScript web application (server and browser UI) added at the repository root; no existing runtime code is modified.
- **Dependencies:** a web framework, a SQLite driver, a PostgreSQL driver, migration tooling, and a test runner. Exact choices are recorded in `design.md`.
- **Configuration:** a new environment-based configuration surface for the database backend, connection settings, and data directory.
- **Data:** a new `documents` table (identifier, name, type, timestamps) with equivalent migrations for both backends.
- **Operations:** single-process deployment must work with SQLite; the same build must run against PostgreSQL without code changes.
- **Documentation:** root `README.md` gains setup, configuration, and run instructions.

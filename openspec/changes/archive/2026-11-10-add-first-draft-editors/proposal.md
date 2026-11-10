# Proposal

## Why

The foundation release ships a document library and four workspaces, but every workspace is an explicitly read-only placeholder, so users can create and open files without being able to do any work in them. This change delivers a usable first draft of each editor with saved content, turning the app into a functioning office suite before deeper per-editor refinement.

## What Changes

- Add a Word editor: a page surface with rich-text editing (headings, bold/italic/underline, bulleted and numbered lists), keyboard undo/redo, and automatic saving.
- Add an Excel editor: an editable cell grid with keyboard navigation, a formula bar, basic arithmetic formulas with cell references and recalculation, and automatic saving.
- Add a PowerPoint editor: a slide list with add, delete, and reorder, a slide canvas with editable text boxes, and automatic saving.
- Add a Drawing editor: a canvas with freehand pen and eraser tools, selectable colors and stroke widths, undo/redo, and automatic saving.
- Add a shared document-content contract: load and save editor content through one API, store it in both SQLite and PostgreSQL, report save status (saved, saving, failed) in the document shell, and delete content with its document.
- Replace the hard-coded read-only `EditorSurface` switch with an editor host/registry that imports each feature's exported entry point, so the four editors can be implemented and reviewed in parallel by their owning agents.
- **BREAKING** (internal behavior contract): `editor-shells` no longer promises read-only surfaces; the read-only notice, read-only badge, and placeholder previews are removed once each editor ships.

**Out of scope for this change:** Office file import/export (DOCX/XLSX/PPTX), real-time collaboration, accounts and permissions, comments, printing/PDF export, advanced formatting (styles, themes, charts, animations, transitions), multi-sheet workbooks, image insertion, shape libraries, and mobile-native apps.

## Capabilities

### New Capabilities

- `word-editor`: rich-text page editing, formatting commands, lists, undo/redo, and document content that survives reload.
- `excel-editor`: editable workbook grid, selection and navigation, formula entry and recalculation, and document content that survives reload.
- `powerpoint-editor`: slide list management, slide canvas text editing, and document content that survives reload.
- `drawing-editor`: freehand and eraser drawing on a canvas, stroke styling, undo/redo, and document content that survives reload.
- `document-content`: the shared load/save contract for editor content, including validation, save-status reporting, version handling, and lifetime tied to the owning document.

### Modified Capabilities

- `editor-shells`: the read-only placeholder requirement is replaced by an editable shell that hosts the type-specific editor and shows its save state.

## Impact

- **New feature code:** `app/features/{word,excel,powerpoint,drawing}/**` and `lib/features/{word,excel,powerpoint,drawing}/**`, each owned by its `*-dev` agent, exporting one documented editor entry point.
- **Shared code:** `app/components/EditorSurface.tsx` becomes an editor host/registry; `DocumentShell.tsx` shows save status and no longer renders a read-only notice; `DocumentWorkspace.tsx` loads content; `app/lib/api-client.ts` gains content calls.
- **API:** new `GET` and `PUT /api/documents/[id]/content` route handlers with validation and conflict responses.
- **Storage:** document content table and repository methods added for both SQLite and PostgreSQL, plus a new migration in each dialect; content is removed when its document is deleted.
- **Dependencies:** no new runtime dependency is required for the first draft; editors use platform text, grid, and canvas primitives, and formulas are evaluated in-repo. Any dependency added later must be proposed by `shared-dev`.
- **Tests:** unit and component tests per feature, shared content API/repository tests covering both backends, updated shared end-to-end tests, and a new end-to-end flow per editor.
- **Documentation:** README and the parallel-agent notes describe the first-draft editor behavior and the shared integration boundary.

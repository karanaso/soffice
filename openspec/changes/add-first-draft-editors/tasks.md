# Tasks

## 1. Shared content foundation (`shared-dev`)

- [x] 1.1 Add the shared content contract in `lib/content/types.ts` and `lib/content/errors.ts` (`ContentCodec`, `DocumentContent`, `ContentValidationError`, `ContentConflictError`, `ContentTooLargeError`), plus `docs/editor-contract.md` describing the codec and `EditorProps` boundary; verify with `npx tsc --noEmit` and confirm every exported name in the doc exists in the types.
- [x] 1.2 Add `0002_create_document_contents.sql` to `lib/db/migrations/sqlite` and `lib/db/migrations/postgres` with a primary key on `document_id`, `ON DELETE CASCADE`, and the revision/content/updated_at columns; verify the migration test creates the table on an empty database, re-runs safely, and preserves existing documents.
- [x] 1.3 Extend `DocumentRepository` with `getContent` and `saveContent` and implement both in `SqliteDocumentRepository` and `PostgresDocumentRepository`, using revision `0` inserts and revision-checked updates inside a transaction; verify the repository contract suite passes for SQLite and, when `TEST_POSTGRES_URL` is set, PostgreSQL.
- [x] 1.4 Extend the repository contract suite with content cases: missing row returns `null`, insert returns revision 1, updates increment the revision, a stale revision throws `ContentConflictError`, a save bumps `documents.updated_at`, and deleting the document removes its content; verify all cases pass on both backends.
- [x] 1.5 Add `lib/content/service.ts` with `createContentService(repository, codecs)` that loads empty content at revision 0, parses and validates saves through the type codec, enforces the 1 MiB serialized limit, returns 404 for missing documents, and maps conflicts; verify unit tests cover each outcome.
- [x] 1.6 Add the content route handlers in `lib/api/content.ts` and `app/api/documents/[id]/content/route.ts` for `GET` and `PUT`, and map `content_conflict` to 409 and `content_too_large` to 413 in `lib/api/errors.ts`; verify handler tests cover 200, 400, 404, 409, and 413 responses.
- [x] 1.7 Add `documentsApi.getContent` and `documentsApi.saveContent` to `app/lib/api-client.ts`; verify tests with a mocked `fetch` cover success, conflict, and validation errors.
- [x] 1.8 Add `useDocumentContent` in `app/lib/use-document-content.ts` with 700 ms debounce, sequential saves, dirty tracking, `visibilitychange`/`pagehide` flush, and conflict pausing; verify fake-timer tests cover debounce, queued saves, retry after failure, and conflict state.
- [x] 1.9 Add the shared `EditorProps` contract in `app/components/editor-contract.ts` and confirm `docs/editor-contract.md` matches it exactly; verify `npx tsc --noEmit` before asking feature agents to start.

## 2. Word editor (`word-dev`)

- [x] 2.1 Add the Word codec in `lib/features/word/content.ts` with the block model from `design.md`; verify unit tests cover the empty document, valid paragraphs/lists/marks, malformed payload rejection, and round-trip through `JSON.stringify`.
- [x] 2.2 Add DOM serialization and initialization helpers for the block model; verify jsdom tests cover paragraphs, heading styles, bold/italic/underline runs, bulleted lists, and numbered lists.
- [x] 2.3 Add the `WordEditor` entry point in `app/features/word/index.ts` with an editable page initialized from the codec output; verify component tests show saved text and accept typing without remounting the page.
- [x] 2.4 Add the toolbar for bold, italic, underline, heading levels, and lists, plus plain-text paste handling; verify component tests (with `execCommand` stubbed) assert each command and that pasted markup is inserted as text.
- [x] 2.5 Wire native undo/redo through the toolbar and Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z; verify an end-to-end test undoes and redoes text and formatting.
- [x] 2.6 Add `e2e/word/persistence.spec.ts` covering typing, formatting, save status reaching Saved, reload, and restored content; verify the spec passes with `npm run test:e2e -- e2e/word`.
- [x] 2.7 Document the Word entry point, `EditorProps`, and content schema in `app/features/word/README.md`; verify the documented import path matches the exported module.

## 3. Excel editor (`excel-dev`)

- [x] 3.1 Add the workbook codec in `lib/features/excel/content.ts` with `cells` and `activeCell`; verify unit tests cover an empty workbook, valid addresses, malformed addresses, and round-trip serialization.
- [x] 3.2 Add the formula tokenizer and recursive-descent parser for numbers, `+ - * /`, parentheses, cell references, ranges, and `SUM`; verify unit tests cover precedence, extra whitespace, and malformed input.
- [x] 3.3 Add evaluation with dependent recalculation and cycle detection returning `#DIV/0!`, `#REF!`, and `#NAME?`; verify unit tests cover chained dependencies, range sums, division by zero, bad references, unknown names, and cycles.
- [x] 3.4 Add the 26×100 `role="grid"` component with column/row headers, active-cell input, formula bar, and keyboard navigation; verify component tests cover click selection, arrows, Tab, Shift+Tab, and boundary clamping.
- [x] 3.5 Add cell commit/cancel, formula display, and undo/redo snapshots; verify component tests cover Enter commit and move, Escape cancel, replacement, and undo/redo recalculating dependents.
- [x] 3.6 Add `e2e/excel/persistence.spec.ts` covering cell entry, a `SUM` formula, recalculation after a referenced cell changes, save status, reload, and restored raw contents/results; verify the spec passes with `npm run test:e2e -- e2e/excel`.
- [x] 3.7 Document the Excel entry point and workbook schema in `app/features/excel/README.md`; verify the documented import path and formula subset match the implementation.

## 4. PowerPoint editor (`powerpoint-dev`)

- [x] 4.1 Add the deck codec in `lib/features/powerpoint/content.ts` with slides and fraction-positioned text boxes; verify unit tests cover an empty deck, multiple slides, malformed boxes, and round-trip serialization.
- [x] 4.2 Add the slide list with add, select, move earlier/later, and delete; verify component tests cover insertion after the current slide, selection highlighting, reorder numbering, deletion, and the last-slide explanation.
- [x] 4.3 Add the 16:9 canvas with add, inline edit, and delete for text boxes; verify component tests add a box, type into it, delete it, and show the text on the selected slide only.
- [x] 4.4 Add pointer dragging with clamping inside the canvas and percentage-based positioning; verify tests assert new positions survive a rerender at a different canvas width.
- [x] 4.5 Add `e2e/powerpoint/persistence.spec.ts` covering add/reorder slides, add/edit/move a text box, save status, reload, and restored order/text/positions; verify the spec passes with `npm run test:e2e -- e2e/powerpoint`.
- [x] 4.6 Document the PowerPoint entry point and deck schema in `app/features/powerpoint/README.md`; verify the documented import path and coordinate convention match the implementation.

## 5. Drawing editor (`drawing-dev`)

- [x] 5.1 Add the drawing codec in `lib/features/drawing/content.ts` with a 1600×900 logical space, strokes, colors, widths, and points; verify unit tests cover an empty drawing, multiple strokes, malformed points, and round-trip serialization.
- [x] 5.2 Add pure geometry helpers for pointer sampling, canvas-to-logical mapping, stroke hit testing, and undo/redo snapshots; verify unit tests cover dot strokes, fast pointer moves, eraser tolerance, undo, redo, and redo clearing.
- [x] 5.3 Add the canvas component with pointer and touch drawing in logical coordinates and device-pixel-ratio scaling; verify component tests (with a mocked 2D context) emit one `onChange` per completed stroke and redraw after size changes.
- [x] 5.4 Add pen/eraser tools, palette and width controls, clear-with-confirmation, and undo/redo buttons; verify component tests cover tool switching, stroke style application, whole-stroke erasing, confirmed clear, cancelled clear, and undo of clear.
- [x] 5.5 Add `e2e/drawing/persistence.spec.ts` covering a drawn stroke, eraser use, undo/redo, save status, reload, and restored relative geometry; verify the spec passes with `npm run test:e2e -- e2e/drawing`.
- [x] 5.6 Document the Drawing entry point and drawing schema in `app/features/drawing/README.md`; verify the documented import path and logical coordinate rule match the implementation.

## 6. Shared shell and registry integration (`shared-dev`)

- [x] 6.1 Create `lib/content/registry.ts` mapping the four document types to their feature codecs, and update `app/components/EditorSurface.tsx` to render the four feature editor components from `app/features/*`; verify component tests render `editor-word`, `editor-excel`, `editor-powerpoint`, and `editor-drawing` and no preview test ids remain.
- [x] 6.2 Update `app/components/DocumentShell.tsx` to load content through `useDocumentContent`, show content loading and recoverable error states, display save status, and remove the read-only notice and badge; verify `DocumentShell` tests cover loading, load failure with retry, Saved/Saving/Unsaved/Save failed, and absence of read-only text.
- [x] 6.3 Add the conflict experience: a `Changed elsewhere` status, a Reload-latest action that asks for confirmation before discarding local edits, and a dismiss action that keeps the local payload; verify tests cover confirm, cancel, and paused saving after dismissal.
- [x] 6.4 Update `app/components/DocumentWorkspace.tsx` and its tests so content loads only for an existing document, deletion removes the open document, and a type mismatch still redirects before content is requested.
- [x] 6.5 Update `e2e/office.spec.ts`: replace the read-only assertions with an editable editor, save status, and reload-restores-content flow, and keep create/rename/delete/tab/address tests passing; verify the spec passes end to end.
- [x] 6.6 Extend the 360px/1280px responsive test to each editor and assert no page overflow, reachable tabs, and usable primary controls; verify the test passes at both viewports.
- [x] 6.7 Update `README.md` and `docs/parallel-agents.md` with first-draft editor behavior, content persistence, the feature/codec contract, and the shared integration sequence; verify every documented command and path exists.
- [x] 6.8 Run `npm test`, `npm run lint`, and `npm run build`; verify all pass after integration and fix any failures introduced by the merge.

## 7. Cross-feature verification

- [x] 7.1 Run the full Vitest suite against SQLite by default and against PostgreSQL via `docker compose -f docker-compose.postgres.yml up -d` plus `TEST_POSTGRES_URL`; verify repository, service, API, and hook tests pass on both backends.
- [x] 7.2 Run the full Playwright suite (`npm run test:e2e`) and verify create/open/edit/save/reload works for all four editors and the library shows edited documents as recently modified.
- [x] 7.3 Review the merged branches and `git diff --stat` to confirm feature agents changed only their owned paths and that shared migrations, registry, API, and shell changes came from `shared-dev`; verify no feature branch edited `openspec/specs/**` or another feature directory.

## Workflow follow-up

- Archive the change after review, syncing the delta specs into `openspec/specs/`.
- Confirm the archived specs and `openspec validate --strict` pass.

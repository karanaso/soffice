# Design

## Context

See `proposal.md` for motivation and the delta specs for required behavior. The foundation already provides typed documents (`word`, `excel`, `powerpoint`, `drawing`), a repository over SQLite and PostgreSQL, an App Router shell, and read-only preview surfaces in `app/components/EditorSurface.tsx`. This change replaces those previews with editors, adds a content store, and creates the feature boundary the five parallel agents need.

Two constraints shape the approach:

- The four editors must be implementable in parallel worktrees without editing shared files. The shared host, content API, migrations, and integration stay with `shared-dev`; each feature agent owns `app/features/<type>/**`, `lib/features/<type>/**`, and `e2e/<type>/**`.
- Content formats differ completely per type, but persistence, save status, validation, and deletion must behave identically for all four.

## Goals / Non-Goals

**Goals:**

- One content contract and one storage table that every editor uses unchanged.
- A feature boundary that can be frozen before parallel work begins: an exported editor component, a pure content codec, and no shared-file edits by feature agents.
- Editors that remain usable at 360px, save without a manual action, and restore exactly what the user sees.
- Additive migration that works on both backends and needs no data backfill.

**Non-Goals:**

- Defining a document interchange format (DOCX/XLSX/PPTX), collaboration, or version history beyond the latest revision.
- Rich formatting parity with desktop office suites, multi-sheet workbooks, slide layouts, or shape libraries.
- Per-editor database tables. Content is one opaque, validated JSON payload per document.
- Server-side rendering of editor content; all editors are client components.

## Decisions

### Content storage: one JSON payload table

Add `document_contents` keyed by document id:

| Column | SQLite | PostgreSQL | Notes |
| --- | --- | --- | --- |
| `document_id` | `TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE` | `uuid PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE` | One row per document |
| `revision` | `INTEGER NOT NULL` | `integer NOT NULL` | Starts at 1; incremented on every save |
| `content` | `TEXT NOT NULL` | `jsonb NOT NULL` | Serialized type-specific JSON |
| `updated_at` | `TEXT NOT NULL` | `timestamptz NOT NULL` | Time of last save |

PostgreSQL uses `jsonb` so the database rejects malformed JSON; SQLite stores text. Both receive the same `JSON.stringify` result from the service, so the repository contract is identical. Content is always read and written whole; no section or cell-level queries are needed in this release.

*Alternatives considered:* per-type tables would let SQL query cells or slides but force a migration and repository surface for every editor change, and none of the first-draft features query content server-side. A separate `content` column on `documents` would make metadata-only queries read large payloads and would mix rename and content concurrency. A separate blob store adds deployment complexity for a first draft.

A content save also updates `documents.updated_at` in the same transaction, so the library's "last modified" ordering reflects editing, not just renaming.

### Content contract: feature-owned codec, shared registry

Each feature exports a pure codec from `lib/features/<type>/content.ts`:

```ts
// lib/content/types.ts (shared)
export interface ContentCodec<T> {
  empty(): T;
  parse(input: unknown): T; // throws ContentValidationError when invalid
}

export interface DocumentContent<T = unknown> {
  documentId: string;
  revision: number;
  content: T;
  updatedAt: string | null;
}
```

`lib/content/registry.ts` (shared) maps each `DocumentType` to its codec. The route handler and the service use that registry, so the server can reject content that does not match the document's type. `createContentService(repository, codecs)` takes the codec map as a parameter so the shared service and its tests can run before the four feature modules land; the production wiring in `lib/content/registry.ts` is added during integration. Codecs must be dependency-free and must not touch the DOM, because the server imports them. Each codec also exports a TypeScript type for the payload (`WordDocument`, `Workbook`, `Deck`, `Drawing`).

*Alternatives considered:* validating with Zod schemas in shared code would put every editor's shape in shared ownership and make feature changes edit shared files. Trusting the client would let one editor overwrite another type's content and would make corrupt stored payloads surface as runtime errors. Per-type endpoints avoid the registry but multiply API routes and error handling.

### Upload limits and validation

The service enforces a 1 MiB limit on the serialized payload before storage and maps failures to:

- `400 validation_error` for a payload the type codec rejects.
- `409 content_conflict` for a stale revision.
- `413 content_too_large` for payloads above the limit.
- `404 not_found` when the document does not exist.

The 1 MiB ceiling is deliberately generous for text, a 26×100 grid, slides, and vector strokes, and it protects both backends from unbounded rows. A future increase is a change to one constant and its tests.

### API: dedicated content resource

Add `GET` and `PUT /api/documents/[id]/content`.

`GET` returns `{ documentId, revision, content, updatedAt }`. When no row exists, it returns the codec's empty document with `revision: 0` and `updatedAt: null`. It returns `404` if the document is gone.

`PUT` accepts `{ revision, content }`, where `revision` is the last revision the editor loaded (`0` for new content). Success returns the new revision and timestamp.

*Alternatives considered:* folding content into `GET/PATCH /api/documents/[id]` would make rename and content saves share one handler and one concurrency rule, but rename is metadata-only and must keep working while an editor is saving. A separate resource keeps the existing rename contract untouched and gives content its own conflict semantics.

### Repository: revision-checked writes

Extend `DocumentRepository` with:

```ts
getContent(documentId: string): Promise<StoredContent | null>;
saveContent(input: {
  documentId: string;
  revision: number;
  content: string;
}): Promise<StoredContent>; // throws ContentConflictError
```

`saveContent` runs in a transaction that first verifies the document exists, then:

- revision `0`: inserts the row; a unique-key violation means another writer created content first → `ContentConflictError`.
- revision `> 0`: `UPDATE ... WHERE document_id = ? AND revision = ? SET revision = revision + 1`; zero affected rows means the revision is stale → `ContentConflictError`.

Both implementations then update `documents.updated_at`. SQLite's connection already enables `foreign_keys`, so `ON DELETE CASCADE` is effective; PostgreSQL enforces it natively. The repository does not delete content explicitly.

*Alternatives considered:* optimistic concurrency via `updated_at` comparison is time-based and can collide within a millisecond. Last-write-wins is simpler but silently loses edits, which the spec forbids. A server-issued ETag would duplicate the revision.

### Editor host: shared state, feature rendering

The shared `app/components/EditorSurface.tsx` becomes an editor host (keeping its name and import site). It imports one entry point per feature and renders the matching component:

```ts
export interface EditorProps {
  documentId: string;
  initialContent: unknown; // already parsed by the matching codec
  onChange: (content: unknown) => void;
}
```

Rules for feature components:

- The component mounts with `initialContent` and owns its DOM/state afterwards. The host never re-renders editor content while the user is typing; a reload mounts a fresh component with a new `key`.
- `onChange` reports the complete serialized payload after each committed change. Feature code decides what "committed" means (keystroke input, cell commit, stroke end, text-box blur).
- No fetch calls and no save-status UI inside the feature. Content load, debounce, retry, and status live in the shared host.
- Tests can mount a feature editor directly with a fixture payload.

`DocumentShell` no longer renders the read-only notice or badge. It renders the save status in the header: `Saved`, `Unsaved changes`, `Saving…`, `Save failed` with Retry, or `Changed elsewhere` with Reload. Content loading shows a skeleton in place of the editor; a load failure shows the existing recoverable error pattern with Retry and Library actions.

*Alternatives considered:* each feature owning its own load/save would duplicate concurrency and autosave logic four times and make save states inconsistent. A plugin registry with runtime metadata adds indirection with no second consumer.

### Autosave and conflict handling

A shared `useDocumentContent` hook in `app/lib` owns the save loop:

1. Start a 700 ms idle timer on each `onChange`; reset it while typing.
2. Save sequentially. If a change arrives during an in-flight save, mark dirty and save again after it completes, using the revision returned by the previous save.
3. Keep only the newest local payload; saves always send the current payload.
4. On `visibilitychange` to hidden and on `pagehide`, attempt an immediate save with `fetch(..., { keepalive: true })`. Register `beforeunload` only while dirty so desktop users get a warning if a final save cannot complete.
5. On `409`, stop retrying automatically and show `Changed elsewhere` with a Reload action. Reloading latest requires confirmation because it discards the local payload; dismissing keeps local edits and leaves saving paused until the user reloads.

The status shown is derived from `dirty`, `saving`, `error`, and `conflict` state rather than inferred from timers, so tests can assert transitions deterministically with fake timers.

*Alternatives considered:* saving on every keystroke overloads storage and races revisions. A manual Save button contradicts the spec. `sendBeacon` cannot send `PUT` with a JSON body reliably, and `keepalive` limits are acceptable for a final attempt only.

### Word: contentEditable with a small block model

Word content is a block model, not raw HTML:

```ts
type WordDocument = { blocks: WordBlock[] };
type WordBlock =
  | { type: "paragraph"; style: "normal" | "h1" | "h2" | "h3"; runs: Run[] }
  | { type: "bullets" | "numbers"; items: Run[][] };
type Run = { text: string; bold?: true; italic?: true; underline?: true };
```

The page is a `contentEditable` region initialized once from the block model. A toolbar applies bold, italic, underline, heading level, and lists. For the first draft the browser editing commands (`execCommand`) perform these operations and native undo/redo; serialization walks the DOM into the block model after each input. Paste is intercepted and inserted as plain text, which drops unsupported formatting.

*Alternatives considered:* a full editor framework (ProseMirror, TipTap, Lexical) gives a robust model and history but adds a substantial dependency and its own schema, which the proposal excludes for this draft. Raw HTML storage would preserve unsupported markup and invite injection on render; the block model keeps saved content constrained and testable. Native undo avoids reimplementing selection-preserving history; the limitation (history resets on reload) is acceptable.

### Excel: 26×100 grid with an in-repo formula evaluator

Workbook content:

```ts
type Workbook = { cells: Record<string, string>; activeCell: string };
```

Cells store raw text; values beginning with `=` are formulas. The grid is a `role="grid"` table with A–Z and 1–100, 2,600 cells; the active cell renders an input, the rest render text. The formula bar shows the active address and raw content. Commit happens on Enter/Tab/blur; Escape restores the previous value.

The evaluator is a small tokenizer plus recursive-descent parser supporting numbers, `+ - * /`, parentheses, cell references, `A1:B3` ranges, and `SUM`. References are resolved against current cells; a per-evaluation visiting set turns cycles and invalid references into `#REF!`, division by zero into `#DIV/0!`, and unknown names into `#NAME?`. All cells are recalculated after a commit; 2,600 cells is small enough to evaluate synchronously. Undo/redo keeps up to 100 committed snapshots of `cells`.

*Alternatives considered:* HyperFormula or a spreadsheet package brings a large dependency and more behavior than the first draft needs. Evaluating only on demand would show stale dependents. Virtualization is unnecessary at 2,600 cells and complicates accessibility and tests.

### PowerPoint: fraction-positioned text boxes

Deck content:

```ts
type Deck = { slides: Slide[] };
type Slide = { id: string; textBoxes: TextBox[] };
type TextBox = {
  id: string;
  x: number; y: number; width: number; height: number; // fractions of the canvas, 0..1
  text: string;
};
```

The canvas is a fixed 16:9 box; text boxes are absolutely positioned with percentage coordinates, so the layout survives resizing. A text box renders a textarea while selected/editing and static text otherwise; dragging uses pointer capture and clamps the box inside the canvas. Slides are added after the current slot, reordered with move-earlier/move-later buttons, and deleted only while more than one remains; the last-slide case shows an explanation and keeps the slide. IDs are generated with `crypto.randomUUID`.

*Alternatives considered:* absolute pixel coordinates break on different viewport sizes. Dragging thumbnails is a nicer reorder interaction but adds pointer complexity; explicit move buttons satisfy the spec and are keyboard-accessible. Storing rendered HTML would make text editing brittle.

### Drawing: logical-space vector strokes

Drawing content:

```ts
type Drawing = {
  width: 1600;
  height: 900;
  strokes: Array<{
    id: string;
    color: string;
    width: number; // logical units
    points: Array<{ x: number; y: number }>; // logical units
  }>;
};
```

A single `<canvas>` is scaled for device pixel ratio and mapped from pointer coordinates into the 1600×900 logical space, so strokes keep their relative positions at any display size. The pen appends sampled points while the pointer is down and emits one `onChange` on release. The eraser hit-tests pointer segments against each stroke segment (with a tolerance) and removes whole strokes. Undo/redo stores snapshots of the stroke array (up to 50); clear-all pushes one snapshot after confirmation. Colors are a fixed accessible palette; widths are three presets.

*Alternatives considered:* storing a bitmap would be simpler but blurry when scaled, large in storage, and impossible to restyle. Freehand erasing that splits strokes adds complexity; whole-stroke erasing is predictable and satisfies the spec. SVG would work but canvas is already used by the shell preview and handles many points faster.

### Parallel delivery sequence

1. `shared-dev` lands the frozen contract first: `lib/content/types.ts`, the migration, repository/service/API, the editor host skeleton, shell save status, and test scaffolding.
2. `word-dev`, `excel-dev`, `powerpoint-dev`, and `drawing-dev` create their codecs, entry points, tests, and e2e specs in their own worktrees against that contract. They do not edit shared files.
3. `shared-dev` merges the feature branches, wires the codecs into `lib/content/registry.ts` and the components into `EditorSurface.tsx`, updates the shared e2e test, and runs the full suite.

The contract is small enough to freeze before step 2; any feature that needs a change reports it to `shared-dev` instead of editing shared code.

## Risks / Trade-offs

- **`execCommand` is deprecated** → it remains supported in current browsers and keeps the first draft dependency-free; the Word codec and toolbar isolate it so a later change can replace the command layer without changing stored content.
- **One JSON payload can grow large** → the 1 MiB limit and type codecs bound it; strokes and cells are compact and no binary data is allowed. If a future editor needs more, move to per-type storage then.
- **Autosave races while typing** → saves are strictly sequential and revision-checked; a stale save becomes a visible conflict rather than silent loss.
- **Conflicts discard local edits on reload** → the Reload action requires confirmation, and dismissing keeps local content in the editor.
- **SQLite cascade depends on a PRAGMA** → the existing connection enables `foreign_keys`; the repository contract test asserts content is removed with its document on both backends.
- **2,600-cell grid re-renders** → the grid is static markup with one active input; measurements and tests should confirm interaction stays responsive at 360px.
- **Canvas coordinate drift** → all stroke geometry is stored in logical units and mapped through one scale function; tests assert round-trip geometry rather than pixel screenshots.
- **Feature branches drift from the host contract** → the contract is frozen before parallel work and integration is a separate shared task; feature agents report interface needs instead of editing shared files.
- **`beforeunload` is unreliable on mobile** → autosave debounce and the `pagehide` keepalive attempt reduce loss; the spec only promises an attempt before leaving.
- **Updated `documents.updated_at` on content saves** → library ordering changes as users type, which is intended but may reorder the dashboard while a document is open; no mitigation needed beyond the existing sort.

## Migration Plan

1. Add `0002_create_document_contents.sql` for SQLite and PostgreSQL. It creates only a new table with a cascading foreign key; no existing rows are modified.
2. Existing documents load with empty content at `revision: 0`, so no backfill is required.
3. Deploy the shared contract, then the editors. Migrations run automatically before the server accepts requests.
4. Rollback: redeploy the previous version. The extra table is ignored by the old code and can be dropped manually if a clean rollback is required; no document metadata is lost.

## Open Questions

None. Content formats, limits, and the editor contract are fixed by this design; per-editor refinements belong to later changes.

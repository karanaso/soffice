# Drawing editor

The Drawing editor is a client-only freehand canvas for soffice. It stores a
small, validated vector scene in the shared document content record; the shared
host owns loading, autosave, retry, conflicts, and the `Saved` status.

## Entry point

```tsx
import { DrawingEditor } from "@/app/features/drawing";
import type { EditorProps } from "@/app/components/editor-contract";

<DrawingEditor
  documentId={document.id}
  initialContent={content}
  onChange={(next) => save(next)}
/>;
```

`DrawingEditor` accepts the shared `EditorProps`:

| Prop | Type | Meaning |
| --- | --- | --- |
| `documentId` | `string` | The document being edited. Used only as a DOM attribute; the editor never fetches. |
| `initialContent` | `unknown` | Content parsed by `drawingCodec`. The editor also falls back to an empty scene if mounted standalone. |
| `onChange` | `(content: unknown) => void` | Receives the complete `Drawing` payload after each committed action. |

The component renders a root element with `data-testid="editor-drawing"` and a
canvas with `data-testid="drawing-canvas"`. It can be mounted on its own in a
test or story without the shared shell.

`app/features/drawing/index.ts` also exports `DRAWING_COLORS`,
`DRAWING_WIDTHS`, and the `Drawing`, `Stroke`, and `Point` types.

## Content schema

The codec lives in `lib/features/drawing/content.ts` and exports
`drawingCodec: ContentCodec<Drawing>`.

```ts
interface Drawing {
  width: 1600;
  height: 900;
  strokes: Stroke[];
}

interface Stroke {
  id: string; // non-empty, at most 128 characters
  color: string; // six-digit hex, for example "#2563eb"
  width: number; // > 0 and <= 100 logical units
  points: Point[]; // one or more points
}

interface Point {
  x: number; // 0..1600
  y: number; // 0..900
}
```

A stroke with a single point is a dot. The codec rejects non-finite or
out-of-range coordinates, unknown fields, invalid colors, non-positive or huge
widths, empty point arrays, and payloads that do not declare the 1600 x 900
canvas. Failures throw `ContentValidationError` from `lib/content/errors.ts`.
The empty payload is `{ width: 1600, height: 900, strokes: [] }`.

## Logical coordinates

All persisted geometry is in a fixed **1600 x 900 logical space**, independent
of the displayed size. Pointer coordinates are mapped through the canvas
bounding rectangle with `toLogicalPoint` and clamped to the canvas. Rendering
sets a canvas transform of `canvas.width / 1600` by `canvas.height / 900`, so
strokes keep their relative positions at any display width.

The canvas backing store is multiplied by `window.devicePixelRatio` for sharp
rendering. A `ResizeObserver` (plus a `window.resize` fallback) re-measures and
redraws after the layout changes.

## Behavior

- **Pen** appends sampled points while a pointer is down. Fast moves are
  interpolated at 2 logical units so the stroke stays continuous. Releasing the
  pointer commits exactly one `onChange`.
- **Eraser** hit-tests the pointer segment against every stroke segment with a
  12-unit tolerance plus the stroke half-width, then removes complete strokes.
  One gesture commits one `onChange`.
- **Click without moving** commits a single-point dot.
- **Color and width** buttons apply to strokes drawn afterwards and are stored
  on each stroke. The palette is six accessible colors; widths are 4, 10, and
  20 logical units.
- **Undo/Redo** keeps up to 50 snapshots of the stroke array. Redo is discarded
  when a new action is recorded.
- **Clear** asks for confirmation, removes every stroke, and is undoable until
  another action is recorded.
- Touch and mouse input use the same pointer path. `touch-action: none` and
  pointer capture keep drawing from scrolling the page.

## Testing

```bash
npx vitest run lib/features/drawing app/features/drawing
```

Unit tests cover codec validation and round-tripping, coordinate mapping,
sampling, hit testing, and history. Component tests mock the canvas 2D context
in jsdom and cover completed-stroke emissions, dots, touch, tool switching,
styles, erasing, clear confirmation, undo/redo, and high-DPI resizing.

The end-to-end spec lives at `e2e/drawing/persistence.spec.ts` and runs after
the shared shell integrates the editor:

```bash
npm run test:e2e -- e2e/drawing
```

## Shared integration

`shared-dev` needs to:

1. Register `drawingCodec` in `lib/content/registry.ts` for the `drawing`
   document type.
2. Render `DrawingEditor` from `app/features/drawing` in `EditorSurface` with
   the parsed `initialContent` and the shared `onChange`.
3. Keep the shared save status in `DocumentShell`; the editor intentionally
   shows no save state.

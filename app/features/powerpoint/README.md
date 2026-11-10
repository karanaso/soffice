# PowerPoint editor

The PowerPoint feature is a self-contained slide deck editor. It can be
mounted on its own or from the shared document shell; it does not fetch
content, save content, or render save status.

## Entry point

```tsx
import { PowerPointEditor } from "@/app/features/powerpoint";
import type { EditorProps } from "@/app/components/editor-contract";
```

`PowerPointEditor` accepts the shared `EditorProps` contract:

| Prop | Type | Purpose |
| --- | --- | --- |
| `documentId` | `string` | The document being edited. |
| `initialContent` | `unknown` | Deck content already parsed by `powerpointCodec`. `null`/`undefined` mounts a new deck. |
| `onChange` | `(content: unknown) => void` | Receives the complete deck after every committed change. |

The host owns loading, autosave, retries, conflicts, and save status. The
component owns selection and editing state after mount. Reloading content
should remount the component with a new `key`.

For example:

```tsx
<PowerPointEditor
  documentId={document.id}
  initialContent={content}
  onChange={onChange}
/>
```

## Deck schema

The codec lives in `lib/features/powerpoint/content.ts` and exports
`powerpointCodec`, `Deck`, `Slide`, and `TextBox`.

```ts
interface Deck {
  slides: Slide[];
}

interface Slide {
  id: string;
  textBoxes: TextBox[];
}

interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}
```

### Coordinate convention

A slide canvas is 16:9. `x`, `y`, `width`, and `height` are fractions of the
canvas in the range `0..1`, not pixels:

- `x = 0.1` places the left edge at 10% of the canvas width.
- `width = 0.4` makes the box 40% of the canvas width.
- boxes must stay inside the canvas (`x + width <= 1` and `y + height <= 1`).
- width and height must be greater than zero.

Storing fractions keeps slide layout stable when the canvas is displayed at a
different size. The editor renders those fractions as percentage positions and
converts pointer movement back into fractions using the canvas bounds.

### Empty content

`powerpointCodec.empty()` returns a valid deck with one empty slide. A deck
always keeps at least one slide, so clicking **Delete slide** on the last slide
keeps it and explains the limit.

`powerpointCodec.parse()` rejects malformed content with
`ContentValidationError`: a missing or empty `slides` array, empty or duplicate
ids, non-finite or out-of-range coordinates, zero or oversized boxes, boxes
outside the canvas, non-string text, and unknown fields.

## Editing behavior

- **Slide list**: slides are numbered in deck order. **Add slide** inserts after
  the selected slide and selects the new one. **Move earlier** and **Move
  later** reorder the selected slide. **Delete slide** removes it and selects an
  adjacent slide, unless it is the last slide.
- **Slide canvas**: **Add text box** creates a selected box with a default
  position. Selected boxes render a textarea for inline editing. **Delete text
  box** removes the selected box.
- **Dragging**: drag a box body (when it is static) or the round handle on a
  selected box. Position updates are clamped to the canvas and reported to
  `onChange` when the drag ends.
- The editor remains usable at 360px: the slide list becomes a horizontal
  strip and toolbar controls wrap.

## Tests

- `lib/features/powerpoint/content.test.ts` covers the codec.
- `app/features/powerpoint/PowerPointEditor.test.tsx` covers the slide list,
  text boxes, dragging, clamping, and reported payloads.
- `e2e/powerpoint/persistence.spec.ts` covers the integrated save/reload flow.

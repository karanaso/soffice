# Excel editor

The first-draft spreadsheet editor for soffice. It is a client component that
renders a 26-column by 100-row `role="grid"` table, an editable active cell, a
formula bar, and undo/redo controls.

## Entry point

```ts
import { ExcelEditor } from "@/app/features/excel";
import type { EditorProps } from "@/app/components/editor-contract";
```

`ExcelEditor` accepts the shared `EditorProps` contract:

| Prop | Type | Meaning |
| --- | --- | --- |
| `documentId` | `string` | The document being edited. Used only as a mount identity. |
| `initialContent` | `unknown` | A workbook already parsed by `excelCodec`. |
| `onChange` | `(content: unknown) => void` | Receives the complete workbook after a commit, undo/redo, or active-selection change. |

The component never fetches, saves, or renders save status. The shared host
owns loading, debounce, retries, conflicts, and the status display. Mounting a
fresh component with a new `key` is the supported reload path.

## Content schema

`lib/features/excel/content.ts` exports the codec and the `Workbook` type:

```ts
interface Workbook {
  cells: Record<string, string>; // raw text keyed by A1..Z100
  activeCell: string; // a valid A1..Z100 address
}
```

- `excelCodec.empty()` returns `{ cells: {}, activeCell: "A1" }`.
- `excelCodec.parse(input)` throws `ContentValidationError` for wrong shapes,
  unknown fields, non-string cell values, or addresses outside A1..Z100.
- Cells store exactly what the user typed. A value that starts with `=` is a
  formula, and its source is preserved for editing.
- Empty strings are not stored by the editor; the UI deletes the key instead.

The codec is dependency-free and DOM-free so the server can import it. It is
intended to be registered as the `excel` entry in `lib/content/registry.ts`
during shared integration.

## Formula subset

`lib/features/excel/formula.ts` is an in-repo tokenizer, recursive-descent
parser, and evaluator. It supports:

- decimal numbers, unary `+`/`-`, binary `+`, `-`, `*`, `/`
- parentheses and arbitrary whitespace
- cell references such as `A1`, `B12`, and `Z100`
- ranges such as `A1:B3` inside `SUM`
- `SUM(...)` with range and scalar arguments; names are case-insensitive
- recalculation of chained dependents after every edit

Errors are returned as standard strings and displayed in the cell while the
formula source stays in the formula bar:

- `#DIV/0!` for division by zero
- `#REF!` for out-of-grid references and dependency cycles
- `#NAME?` for unknown names/functions, unparseable formulas, and non-numeric
  text used directly in arithmetic

`SUM` ignores blank cells and non-numeric text inside a range. Independent
cells recalculate even when another formula has an error. Cycle detection uses
a per-evaluation visiting set, so indirect cycles collapse to `#REF!` without
recursing forever.

## Interaction

- Click a cell to make it active; its raw text appears in the formula bar.
- Arrow keys, `Tab`, and `Shift+Tab` move the active cell and clamp at the
  A1/Z100 boundaries.
- `Enter` commits the draft and moves down one cell.
- `Tab`/`Shift+Tab` commit and move horizontally.
- `Escape` restores the cell's previous raw value.
- Blur also commits a draft.
- Undo and redo keep up to 100 snapshots of `cells`; a new commit after undo
  clears the redo stack. `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+Y`
  are supported while the grid has focus.
- Every formula cell is recalculated synchronously after a commit.

The layout is usable at 360px: the grid scrolls horizontally inside its own
container and does not cause page-level overflow.

## Stable test hooks

| Selector | Element |
| --- | --- |
| `[data-testid="editor-excel"]` | Editor root |
| `[data-testid="excel-grid"]` | `role="grid"` table |
| `[data-testid="cell-A1"]` | A grid cell (`cell-<address>`) |
| `[data-testid="excel-address"]` | Active cell address in the formula bar |
| `[data-testid="excel-formula-input"]` | Formula bar input (raw active value) |
| `[data-testid="excel-active-input"]` | Active cell input |
| `[data-testid="excel-undo"]` / `excel-redo` | History buttons |

The active input is labelled `Cell <address>` and the formula bar is labelled
`Formula bar` for accessible queries.

## Tests

- `lib/features/excel/content.test.ts` — codec, addresses, and round-tripping.
- `lib/features/excel/formula.test.ts` — precedence, whitespace, references,
  ranges, recalculation, errors, and cycles.
- `app/features/excel/ExcelEditor.test.tsx` — grid structure, pointer/keyboard
  selection, commit/cancel, formula display, errors, and history.
- `e2e/excel/persistence.spec.ts` — entry, `SUM`, dependent recalculation,
  save status, reload, and restored raw values/results. It runs after the
  shared shell registers the editor.

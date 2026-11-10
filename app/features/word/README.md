# Word editor

The Word feature exposes one client component and one pure content codec. The
shared host loads and saves content; this feature only edits and serializes it.

## Entry point

```tsx
"use client";

import { WordEditor, type EditorProps } from "@/app/features/word";

export function HostEditor(props: EditorProps) {
  return <WordEditor {...props} />;
}
```

`EditorProps` is the frozen host contract from
`app/components/editor-contract.ts`:

| Prop | Meaning |
| --- | --- |
| `documentId` | The Word document being edited. Used for the `data-document-id` marker only. |
| `initialContent` | The payload already parsed by `wordCodec`. It is read once on mount. |
| `onChange` | Called with the complete `WordDocument` after input, toolbar formatting, paste, undo, and redo. |

Rules the component follows:

- It initialises the editable page once and never replaces it when the host
  re-renders. Reloading content requires a fresh mount with a new `key`.
- It never fetches, saves, or renders save status. Debounce, retry, conflicts,
  and the `Saved` / `Saving…` / `Unsaved changes` labels belong to the host.
- The editable page carries `data-testid="word-page"`, `role="textbox"`,
  `aria-multiline="true"`, and the accessible name `Word document`. The outer
  editor carries `data-testid="editor-word"`.

## Content schema

```ts
interface WordDocument {
  blocks: WordBlock[];
}

type WordBlock =
  | { type: "paragraph"; style: "normal" | "h1" | "h2" | "h3"; runs: Run[] }
  | { type: "bullets" | "numbers"; items: Run[][] };

interface Run {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
}
```

- Enter creates a new paragraph block. Shift+Enter inserts `\n` inside a run,
  which is rendered as a `<br>` within the paragraph.
- A list block groups one list's items; adjacent lists of the same type are
  merged when serialized.
- Marks are only present when `true`. Parsing rejects `false`, unknown fields,
  unknown block types, and values outside the documented styles.
- `wordCodec.empty()` returns `{ blocks: [] }`. Parsing that payload or any
  valid document returns a fully typed `WordDocument`; invalid payloads throw
  `ContentValidationError` from `lib/content/errors.ts`.

## Modules

| Module | Purpose |
| --- | --- |
| `lib/features/word/content.ts` | `wordCodec`, `WordDocument`, `WordBlock`, `Run`, and strict shape validation. Pure and DOM-free so the server can import it. |
| `lib/features/word/dom.ts` | `renderWordDocument`, `serializeWordDocument`, `mergeRuns`, and `wordDocumentToHtml` for the editing DOM. |
| `app/features/word/WordEditor.tsx` | The editing surface and toolbar. |
| `app/features/word/index.ts` | Stable public entry point: `WordEditor` and the `EditorProps` type. |

## Editing behaviour

- Toolbar buttons: bold, italic, underline, paragraph, heading 1–3, bulleted
  list, numbered list, undo, and redo. Commands use `document.execCommand` when
  the browser provides it and are guarded so tests and unsupported browsers do
  not crash.
- `Ctrl/Cmd+Z` undoes and `Ctrl/Cmd+Shift+Z` (or `Ctrl/Cmd+Y`) redoes. The
  browser's native editing history backs both the keyboard shortcuts and the
  toolbar buttons. History is per page session and resets on reload.
- Paste reads only `text/plain` and inserts it as text, so unsupported fonts,
  colours, and layout from other applications never enter the content model.
- The page and toolbar wrap at 360px and the toolbar buttons keep a 34–36px
  touch target.

## Serialization notes

`serializeWordDocument` walks the edited DOM and builds the constrained block
model. It understands the markup produced by browser editing commands:
`<strong>`, `<em>`, `<u>`, legacy `<b>`/`<i>`, inline `font-weight`,
`font-style`, and `text-decoration` styles, `<div>` paragraphs, and
`<ul>`/`<ol>` lists. Unsupported top-level markup is reduced to a plain
paragraph. A lone placeholder `<br>` in an empty paragraph is treated as an
empty document.

## Tests

```sh
npx vitest run lib/features/word app/features/word
```

Codec tests run in Node; DOM and component tests use the `jsdom` environment.
`e2e/word/persistence.spec.ts` is written against the integrated shell and is
run by the host after `shared-dev` registers the editor.

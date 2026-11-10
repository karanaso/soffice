# Editor contract

The shared host and the four feature editors meet at two small interfaces. The
contract is frozen before parallel work starts; changing it is a `shared-dev`
change.

## Content codec

Each feature exports a pure codec from `lib/features/<type>/content.ts`:

```ts
import type { ContentCodec } from "@/lib/content/types";

export interface WordDocument {
  // The feature's payload type.
}

export const wordCodec: ContentCodec<WordDocument> = {
  empty(): WordDocument {
    return { blocks: [] };
  },
  parse(input: unknown): WordDocument {
    // Return a fully validated payload or throw ContentValidationError.
  },
};
```

Rules:

- `empty()` returns the payload for a document that has never been saved.
- `parse()` accepts the stored JSON value and returns the typed payload. It
  throws `ContentValidationError` for wrong shapes, unknown fields, or values
  outside the document type's limits.
- Codecs are imported by server code. They must not touch the DOM, `window`,
  `canvas`, or browser-only APIs. DOM helpers belong in `app/features/<type>`.
- Payloads are stored as JSON. Keep them compact and below
  `MAX_CONTENT_BYTES` (1 MiB serialized).

## Editor component

Each feature exports one client component and its props:

```ts
import type { EditorProps } from "@/components/editor-contract";

export function WordEditor({ documentId, initialContent, onChange }: EditorProps) {
  // Render the editor and call onChange with the complete payload after each
  // committed change.
}
```

Rules:

- The host passes `initialContent` already parsed by the feature's codec.
- The editor owns its state after mount. The host does not re-render content
  while the user is typing; a reload mounts a fresh component with a new `key`.
- `onChange` reports the complete serialized payload, not a patch.
- Editors do not fetch, save, or show save status. The shared host owns loading,
  debounce, retry, conflict handling, and the status display.
- Editors must remain usable at 360px and must not call `fetch` directly.

## Shared files

Feature agents do not edit `app/components/EditorSurface.tsx`,
`DocumentShell.tsx`, `DocumentWorkspace.tsx`, `lib/content/**` (except their own
feature codec lives under `lib/features/<type>`), API routes, repositories,
migrations, or `package.json`. Report the needed interface or schema change to
`shared-dev`.

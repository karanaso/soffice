/**
 * Props every feature editor receives from the shared host.
 *
 * The host loads and validates content, passes it once on mount, then never
 * re-renders the editor's content while the user is typing. Reloading content
 * mounts a fresh editor with a new `key`.
 */
export interface EditorProps {
  /** The id of the document being edited. */
  documentId: string;
  /** Content already parsed by the matching content codec. */
  initialContent: unknown;
  /** Report the complete serialized payload after each committed change. */
  onChange: (content: unknown) => void;
}

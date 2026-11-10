import { ValidationError } from "./errors";

export const MAX_DOCUMENT_NAME_LENGTH = 120;

/**
 * Validates a document name after trimming. Length is counted in Unicode code
 * points so an emoji counts as one character.
 */
export function validateDocumentName(input: unknown): string {
  if (typeof input !== "string") {
    throw new ValidationError("Document name must be text.");
  }

  const name = input.trim();
  if (name.length === 0) {
    throw new ValidationError("Document name cannot be empty.");
  }

  if (Array.from(name).length > MAX_DOCUMENT_NAME_LENGTH) {
    throw new ValidationError(
      `Document name must be ${MAX_DOCUMENT_NAME_LENGTH} characters or fewer.`,
    );
  }

  return name;
}

/**
 * The key used for case-insensitive uniqueness. It deliberately uses
 * locale-independent lower-casing so SQLite and PostgreSQL agree.
 */
export function documentNameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}

export function normalizeDocumentName(input: unknown): {
  name: string;
  nameKey: string;
} {
  const name = validateDocumentName(input);
  return { name, nameKey: documentNameKey(name) };
}

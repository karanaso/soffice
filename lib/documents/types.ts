export const DOCUMENT_TYPES = [
  "word",
  "excel",
  "powerpoint",
  "drawing",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  word: "Word",
  excel: "Excel",
  powerpoint: "PowerPoint",
  drawing: "Drawing",
};

export const DOCUMENT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  word: "Written documents, letters, and lesson plans.",
  excel: "Tables, marks, and simple calculations.",
  powerpoint: "Slide decks for lessons and assemblies.",
  drawing: "Sketches, diagrams, and illustrations.",
};

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  createdAt: string;
  updatedAt: string;
}

export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === "string" &&
    (DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

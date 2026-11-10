import type { DatabaseDialect } from "../db/client";
import type { StoredContent } from "../content/types";
import type { Document, DocumentType } from "./types";

export interface CreateDocumentInput {
  id: string;
  name: string;
  type: DocumentType;
}

export interface SaveContentInput {
  documentId: string;
  revision: number;
  content: string;
}

export interface DocumentRepository {
  readonly backend: DatabaseDialect;

  list(): Promise<Document[]>;
  get(id: string): Promise<Document | null>;
  create(input: CreateDocumentInput): Promise<Document>;
  rename(id: string, name: string): Promise<Document>;
  delete(id: string): Promise<boolean>;
  getContent(documentId: string): Promise<StoredContent | null>;
  saveContent(input: SaveContentInput): Promise<StoredContent>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface RepositoryOptions {
  now?: () => Date;
}

export function nextUpdatedAt(previous: string, now: Date): string {
  const candidate = now.toISOString();
  if (candidate > previous) {
    return candidate;
  }
  return new Date(Date.parse(previous) + 1).toISOString();
}

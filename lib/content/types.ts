import type { DocumentType } from "../documents/types";

/**
 * The maximum serialized size of a document content payload.
 * Shared by the service, API, and editor save loop.
 */
export const MAX_CONTENT_BYTES = 1024 * 1024;

/**
 * A pure, dependency-free validator/serializer for one document type.
 * Codecs are imported by the server, so they must not touch the DOM.
 */
export interface ContentCodec<T = unknown> {
  empty(): T;
  parse(input: unknown): T;
}

/**
 * The payload returned by the content API and repository.
 * `revision` is 0 when a document has no saved content yet.
 */
export interface DocumentContent<T = unknown> {
  documentId: string;
  revision: number;
  content: T;
  updatedAt: string | null;
}

/** The stored representation, where content is serialized JSON. */
export interface StoredContent {
  documentId: string;
  revision: number;
  content: string;
  updatedAt: string;
}

export type ContentCodecMap = Record<DocumentType, ContentCodec>;

export function serializeContent(content: unknown): string {
  return JSON.stringify(content);
}

export function contentByteLength(serialized: string): number {
  return new TextEncoder().encode(serialized).length;
}

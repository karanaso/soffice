import { NotFoundError } from "../documents/errors";
import type { DocumentRepository } from "../documents/repository";
import type { DocumentType } from "../documents/types";
import { ContentTooLargeError, ContentValidationError } from "./errors";
import {
  contentByteLength,
  MAX_CONTENT_BYTES,
  serializeContent,
  type ContentCodecMap,
  type DocumentContent,
} from "./types";

export interface SaveContentRequest {
  revision: unknown;
  content: unknown;
}

export interface ContentService {
  get(documentId: string): Promise<DocumentContent>;
  save(
    documentId: string,
    request: SaveContentRequest,
  ): Promise<DocumentContent>;
}

function parseStored(
  codec: ContentCodecMap[DocumentType],
  serialized: string,
): unknown {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new ContentValidationError(
      "The saved document content could not be read.",
    );
  }
  return codec.parse(value);
}

export class RepositoryContentService implements ContentService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly codecs: ContentCodecMap,
  ) {}

  async get(documentId: string): Promise<DocumentContent> {
    const document = await this.repository.get(documentId);
    if (!document) {
      throw new NotFoundError();
    }

    const codec = this.codecs[document.type];
    if (!codec) {
      throw new ContentValidationError(
        `No editor is registered for ${document.type} documents.`,
      );
    }

    const stored = await this.repository.getContent(documentId);
    if (!stored) {
      return {
        documentId,
        revision: 0,
        content: codec.empty(),
        updatedAt: null,
      };
    }

    return {
      documentId,
      revision: stored.revision,
      content: parseStored(codec, stored.content),
      updatedAt: stored.updatedAt,
    };
  }

  async save(
    documentId: string,
    request: SaveContentRequest,
  ): Promise<DocumentContent> {
    const document = await this.repository.get(documentId);
    if (!document) {
      throw new NotFoundError();
    }

    const codec = this.codecs[document.type];
    if (!codec) {
      throw new ContentValidationError(
        `No editor is registered for ${document.type} documents.`,
      );
    }

    const revision = request.revision;
    if (
      typeof revision !== "number" ||
      !Number.isInteger(revision) ||
      revision < 0
    ) {
      throw new ContentValidationError(
        "Provide the revision you loaded before saving.",
      );
    }

    const normalized = codec.parse(request.content);
    const serialized = serializeContent(normalized);
    if (contentByteLength(serialized) > MAX_CONTENT_BYTES) {
      throw new ContentTooLargeError();
    }

    const stored = await this.repository.saveContent({
      documentId,
      revision,
      content: serialized,
    });

    return {
      documentId,
      revision: stored.revision,
      content: normalized,
      updatedAt: stored.updatedAt,
    };
  }
}

export function createContentService(
  repository: DocumentRepository,
  codecs: ContentCodecMap,
): ContentService {
  return new RepositoryContentService(repository, codecs);
}

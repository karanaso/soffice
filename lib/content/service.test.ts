import { describe, expect, it } from "vitest";
import type { StoredContent } from "./types";
import {
  ContentConflictError,
  ContentTooLargeError,
  ContentValidationError,
} from "./errors";
import { createContentService } from "./service";
import type { DocumentRepository } from "../documents/repository";
import { NotFoundError } from "../documents/errors";
import type { Document, DocumentType } from "../documents/types";
import type { ContentCodecMap } from "./types";

const wordCodec = {
  empty: () => ({ text: "" }),
  parse(input: unknown) {
    if (
      !input ||
      typeof input !== "object" ||
      typeof (input as { text?: unknown }).text !== "string"
    ) {
      throw new ContentValidationError("Word content must have text.");
    }
    return { text: (input as { text: string }).text };
  },
};

const codecs: ContentCodecMap = {
  word: wordCodec,
  excel: { empty: () => ({ cells: {} }), parse: (input) => input },
  powerpoint: { empty: () => ({ slides: [] }), parse: (input) => input },
  drawing: { empty: () => ({ strokes: [] }), parse: (input) => input },
};

class FakeRepository implements DocumentRepository {
  readonly backend = "sqlite" as const;
  readonly documents = new Map<string, Document>();
  readonly contents = new Map<string, StoredContent>();
  updatedAt = "2026-01-01T00:00:00.000Z";
  conflictOnSave = false;

  addDocument(id: string, type: DocumentType = "word"): Document {
    const document: Document = {
      id,
      name: `Document ${id}`,
      type,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: this.updatedAt,
    };
    this.documents.set(id, document);
    return document;
  }

  async list(): Promise<Document[]> {
    return [...this.documents.values()];
  }

  async get(id: string): Promise<Document | null> {
    return this.documents.get(id) ?? null;
  }

  async create(input: {
    id: string;
    name: string;
    type: DocumentType;
  }): Promise<Document> {
    const document: Document = {
      ...input,
      createdAt: this.updatedAt,
      updatedAt: this.updatedAt,
    };
    this.documents.set(input.id, document);
    return document;
  }

  async rename(id: string, name: string): Promise<Document> {
    const document = this.documents.get(id);
    if (!document) {
      throw new NotFoundError();
    }
    const updated = { ...document, name };
    this.documents.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    this.contents.delete(id);
    return this.documents.delete(id);
  }

  async getContent(documentId: string): Promise<StoredContent | null> {
    return this.contents.get(documentId) ?? null;
  }

  async saveContent(input: {
    documentId: string;
    revision: number;
    content: string;
  }): Promise<StoredContent> {
    if (this.conflictOnSave) {
      throw new ContentConflictError();
    }
    const stored: StoredContent = {
      documentId: input.documentId,
      revision: input.revision + 1,
      content: input.content,
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    this.contents.set(input.documentId, stored);
    return stored;
  }

  async ping(): Promise<void> {}
  async close(): Promise<void> {}
}

function createFixture(): {
  repository: FakeRepository;
  service: ReturnType<typeof createContentService>;
} {
  const repository = new FakeRepository();
  repository.addDocument("doc-1");
  return {
    repository,
    service: createContentService(repository, codecs),
  };
}

describe("content service", () => {
  it("returns empty content at revision 0 for a new document", async () => {
    const { service } = createFixture();

    await expect(service.get("doc-1")).resolves.toEqual({
      documentId: "doc-1",
      revision: 0,
      content: { text: "" },
      updatedAt: null,
    });
  });

  it("returns stored content parsed by the document's codec", async () => {
    const { repository, service } = createFixture();
    repository.contents.set("doc-1", {
      documentId: "doc-1",
      revision: 3,
      content: '{"text":"Hello"}',
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    await expect(service.get("doc-1")).resolves.toEqual({
      documentId: "doc-1",
      revision: 3,
      content: { text: "Hello" },
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("returns NotFound for a missing document", async () => {
    const { service } = createFixture();

    await expect(service.get("missing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      service.save("missing", { revision: 0, content: { text: "" } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates and normalizes content before saving", async () => {
    const { repository, service } = createFixture();

    const saved = await service.save("doc-1", {
      revision: 0,
      content: { text: "Hello", ignored: true },
    });

    expect(saved).toEqual({
      documentId: "doc-1",
      revision: 1,
      content: { text: "Hello" },
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(repository.contents.get("doc-1")?.content).toBe('{"text":"Hello"}');
  });

  it("rejects invalid content", async () => {
    const { service } = createFixture();

    await expect(
      service.save("doc-1", { revision: 0, content: { text: 42 } }),
    ).rejects.toBeInstanceOf(ContentValidationError);
  });

  it("rejects an invalid revision", async () => {
    const { service } = createFixture();

    await expect(
      service.save("doc-1", { revision: -1, content: { text: "" } }),
    ).rejects.toBeInstanceOf(ContentValidationError);
    await expect(
      service.save("doc-1", { revision: "0", content: { text: "" } }),
    ).rejects.toBeInstanceOf(ContentValidationError);
  });

  it("rejects oversized content", async () => {
    const { service } = createFixture();

    await expect(
      service.save("doc-1", {
        revision: 0,
        content: { text: "x".repeat(1024 * 1024 + 1) },
      }),
    ).rejects.toBeInstanceOf(ContentTooLargeError);
  });

  it("propagates a stale revision conflict", async () => {
    const { repository, service } = createFixture();
    repository.conflictOnSave = true;

    await expect(
      service.save("doc-1", { revision: 1, content: { text: "Hello" } }),
    ).rejects.toBeInstanceOf(ContentConflictError);
  });

  it("reports unreadable stored content as a validation error", async () => {
    const { repository, service } = createFixture();
    repository.contents.set("doc-1", {
      documentId: "doc-1",
      revision: 1,
      content: "not json",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    await expect(service.get("doc-1")).rejects.toBeInstanceOf(
      ContentValidationError,
    );
  });
});

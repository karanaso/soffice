import { describe, expect, it, vi } from "vitest";
import type { Document } from "../documents/types";
import {
  NameConflictError,
  NotFoundError,
  ValidationError,
} from "../documents/errors";
import type { DocumentService } from "../documents/service";
import {
  createDocumentHandlers,
  createDocumentsHandlers,
} from "./documents";

const document: Document = {
  id: "8a5f1f14-7baf-4c17-9f57-2b5f6f48c110",
  name: "Lesson plan",
  type: "word",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function fakeService(overrides: Partial<DocumentService> = {}): DocumentService {
  return {
    list: vi.fn(async () => [document]),
    get: vi.fn(async () => document),
    create: vi.fn(async () => document),
    rename: vi.fn(async () => document),
    delete: vi.fn(async () => true),
    ...overrides,
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("documents collection handlers", () => {
  it("lists documents", async () => {
    const response = await createDocumentsHandlers(fakeService()).GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ documents: [document] });
  });

  it("creates a named document", async () => {
    const service = fakeService();
    const response = await createDocumentsHandlers(service).POST(
      jsonRequest({ type: "word", name: "Lesson plan" }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(document);
    expect(service.create).toHaveBeenCalledWith({
      type: "word",
      name: "Lesson plan",
    });
  });

  it("passes an omitted name so the service can generate one", async () => {
    const service = fakeService({
      create: vi.fn(async () => ({
        ...document,
        name: "Untitled Word document",
      })),
    });
    const response = await createDocumentsHandlers(service).POST(
      jsonRequest({ type: "word" }),
    );

    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith({
      type: "word",
      name: undefined,
    });
  });

  it("returns 400 for malformed JSON and bad types", async () => {
    const handlers = createDocumentsHandlers(
      fakeService({
        create: vi.fn(async ({ type }) => {
          if (type !== "word") {
            throw new ValidationError("Unknown document type.");
          }
          return document;
        }),
      }),
    );
    const malformed = await handlers.POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);

    const invalid = await handlers.POST(jsonRequest({ type: "pdf" }));
    expect(invalid.status).toBe(400);
  });

  it("returns 500 with a non-sensitive error when listing fails", async () => {
    const response = await createDocumentsHandlers(
      fakeService({
        list: vi.fn(async () => {
          throw new Error(
            "connect ECONNREFUSED postgres://user:supersecret@db/school",
          );
        }),
      }),
    ).GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("storage_error");
    expect(JSON.stringify(body)).not.toContain("supersecret");
  });
});

describe("document item handlers", () => {
  it("gets a document by id and returns 404 when missing", async () => {
    const found = await createDocumentHandlers(fakeService()).GET(
      new Request("http://localhost"),
      context(document.id),
    );
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(document);

    const missing = await createDocumentHandlers(
      fakeService({ get: vi.fn(async () => null) }),
    ).GET(new Request("http://localhost"), context("missing"));
    expect(missing.status).toBe(404);
  });

  it("renames a document", async () => {
    const service = fakeService();
    const response = await createDocumentHandlers(service).PATCH(
      jsonRequest({ name: "New name" }),
      context(document.id),
    );

    expect(response.status).toBe(200);
    expect(service.rename).toHaveBeenCalledWith(document.id, "New name");
  });

  it("returns 400 for an invalid or missing rename", async () => {
    const handlers = createDocumentHandlers(
      fakeService({
        rename: vi.fn(async (_id: string, name: unknown) => {
          if (typeof name !== "string" || name.length > 120) {
            throw new ValidationError("Invalid document name.");
          }
          return document;
        }),
      }),
    );

    const missing = await handlers.PATCH(
      jsonRequest({}),
      context(document.id),
    );
    expect(missing.status).toBe(400);

    const invalid = await handlers.PATCH(
      jsonRequest({ name: "x".repeat(121) }),
      context(document.id),
    );
    expect(invalid.status).toBe(400);
  });

  it("returns 409 for a name conflict", async () => {
    const response = await createDocumentHandlers(
      fakeService({
        rename: vi.fn(async () => {
          throw new NameConflictError();
        }),
      }),
    ).PATCH(jsonRequest({ name: "Taken" }), context(document.id));

    expect(response.status).toBe(409);
  });

  it("returns 404 when renaming a missing document", async () => {
    const response = await createDocumentHandlers(
      fakeService({
        rename: vi.fn(async () => {
          throw new NotFoundError();
        }),
      }),
    ).PATCH(jsonRequest({ name: "Name" }), context("missing"));

    expect(response.status).toBe(404);
  });

  it("deletes a document and returns 404 when it does not exist", async () => {
    const success = await createDocumentHandlers(fakeService()).DELETE(
      new Request("http://localhost"),
      context(document.id),
    );
    expect(success.status).toBe(204);

    const missing = await createDocumentHandlers(
      fakeService({
        delete: vi.fn(async () => {
          throw new NotFoundError();
        }),
      }),
    ).DELETE(new Request("http://localhost"), context("missing"));
    expect(missing.status).toBe(404);
  });
});

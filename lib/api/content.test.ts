import { describe, expect, it } from "vitest";
import { createContentHandlers } from "./content";
import type { ContentService } from "../content/service";
import {
  ContentConflictError,
  ContentTooLargeError,
  ContentValidationError,
} from "../content/errors";
import { NotFoundError } from "../documents/errors";

const stored = {
  documentId: "doc-1",
  revision: 2,
  content: { text: "Hello" },
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function context(id = "doc-1") {
  return { params: Promise.resolve({ id }) };
}

function handlers(service: ContentService) {
  return createContentHandlers(service);
}

function service(overrides: Partial<ContentService> = {}): ContentService {
  return {
    get: async () => stored,
    save: async () => stored,
    ...overrides,
  };
}

function put(body: unknown): Request {
  return new Request("http://localhost/api/documents/doc-1/content", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("content API", () => {
  it("returns stored content", async () => {
    const response = await handlers(service()).GET(
      new Request("http://localhost/api/documents/doc-1/content"),
      context(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(stored);
  });

  it("saves content with the loaded revision", async () => {
    const save = async (
      documentId: string,
      request: { revision: unknown; content: unknown },
    ) => {
      expect(documentId).toBe("doc-1");
      expect(request).toEqual({ revision: 1, content: { text: "Hello" } });
      return stored;
    };
    const response = await handlers(service({ save })).PUT(
      put({ revision: 1, content: { text: "Hello" } }),
      context(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(stored);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request(
      "http://localhost/api/documents/doc-1/content",
      { method: "PUT", body: "{" },
    );
    const response = await handlers(service()).PUT(request, context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "validation_error" },
    });
  });

  it("returns 400 when revision or content is missing", async () => {
    const response = await handlers(service()).PUT(
      put({ content: {} }),
      context(),
    );

    expect(response.status).toBe(400);
  });

  it("maps validation failures to 400", async () => {
    const response = await handlers(
      service({
        save: async () => {
          throw new ContentValidationError("Bad content");
        },
      }),
    ).PUT(put({ revision: 1, content: {} }), context());

    expect(response.status).toBe(400);
  });

  it("maps a missing document to 404", async () => {
    const response = await handlers(
      service({
        get: async () => {
          throw new NotFoundError();
        },
      }),
    ).GET(
      new Request("http://localhost/api/documents/missing/content"),
      context("missing"),
    );

    expect(response.status).toBe(404);
  });

  it("maps a stale revision to 409", async () => {
    const response = await handlers(
      service({
        save: async () => {
          throw new ContentConflictError();
        },
      }),
    ).PUT(put({ revision: 1, content: {} }), context());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "content_conflict" },
    });
  });

  it("maps oversized content to 413", async () => {
    const response = await handlers(
      service({
        save: async () => {
          throw new ContentTooLargeError();
        },
      }),
    ).PUT(put({ revision: 1, content: {} }), context());

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "content_too_large" },
    });
  });
});

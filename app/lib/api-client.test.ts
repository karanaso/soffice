import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, documentsApi } from "./api-client";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("documentsApi content", () => {
  it("loads content", async () => {
    const payload = {
      documentId: "doc-1",
      revision: 2,
      content: { text: "Hello" },
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async () => response(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(documentsApi.getContent("doc-1")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-1/content",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("saves content with the loaded revision", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        documentId: "doc-1",
        revision: 3,
        content: { text: "Hi" },
        updatedAt: "2026-01-02T00:00:01.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await documentsApi.saveContent("doc-1", {
      revision: 2,
      content: { text: "Hi" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-1/content",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ revision: 2, content: { text: "Hi" } }),
      }),
    );
  });

  it("surfaces a conflict code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          { error: { code: "content_conflict", message: "Changed elsewhere" } },
          409,
        ),
      ),
    );

    await expect(
      documentsApi.saveContent("doc-1", { revision: 1, content: {} }),
    ).rejects.toMatchObject({
      status: 409,
      code: "content_conflict",
    });
  });

  it("surfaces validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          { error: { code: "validation_error", message: "Bad content" } },
          400,
        ),
      ),
    );

    await expect(
      documentsApi.saveContent("doc-1", { revision: 1, content: {} }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });
});

// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "./api-client";
import { useDocumentContent } from "./use-document-content";

const initial = {
  documentId: "doc-1",
  revision: 0,
  content: { text: "" },
  updatedAt: null,
};

const DEBOUNCE = 20;

function saved(revision: number, content: unknown) {
  return {
    documentId: "doc-1",
    revision,
    content,
    updatedAt: `2026-01-0${revision + 1}T00:00:00.000Z`,
  };
}

async function wait(ms = DEBOUNCE + 15) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDocumentContent", () => {
  it("loads content and reports saved", async () => {
    const load = vi.fn(async () => initial);
    const { result } = renderHook(() =>
      useDocumentContent({ documentId: "doc-1", load }),
    );

    await settle();

    expect(result.current.loading).toBe(false);
    expect(result.current.content).toEqual({ text: "" });
    expect(result.current.status).toBe("saved");
  });

  it("debounces changes and saves after the idle period", async () => {
    const save = vi.fn(
      async (_id: string, input: { content: unknown }) =>
        saved(1, input.content),
    );
    const { result } = renderHook(() =>
      useDocumentContent({
        documentId: "doc-1",
        load: async () => initial,
        save,
        debounceMs: DEBOUNCE,
      }),
    );

    await settle();
    await act(async () => {
      result.current.change({ text: "Hello" });
    });
    expect(result.current.status).toBe("dirty");

    await wait(DEBOUNCE / 2);
    expect(save).not.toHaveBeenCalled();

    await wait();
    expect(save).toHaveBeenCalledWith(
      "doc-1",
      { revision: 0, content: { text: "Hello" } },
      {},
    );
    expect(result.current.status).toBe("saved");
    expect(result.current.revision).toBe(1);
  });

  it("queues a second save when content changes during an in-flight save", async () => {
    let resolveFirst: () => void = () => undefined;
    const save = vi
      .fn()
      .mockImplementationOnce(
        (_id: string, input: { content: unknown }) =>
          new Promise((resolve) => {
            resolveFirst = () => resolve(saved(1, input.content));
          }),
      )
      .mockImplementation(
        async (_id: string, input: { content: unknown }) =>
          saved(2, input.content),
      );

    const { result } = renderHook(() =>
      useDocumentContent({
        documentId: "doc-1",
        load: async () => initial,
        save,
        debounceMs: DEBOUNCE,
      }),
    );
    await settle();

    act(() => result.current.change({ text: "First" }));
    await wait();
    expect(save).toHaveBeenCalledTimes(1);

    act(() => result.current.change({ text: "Second" }));
    await act(async () => {
      resolveFirst();
      await Promise.resolve();
    });

    await wait();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[1]).toEqual({
      revision: 1,
      content: { text: "Second" },
    });
    expect(result.current.status).toBe("saved");
  });

  it("reports a save error and retries on demand", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Storage is down"))
      .mockImplementation(
        async (_id: string, input: { content: unknown }) =>
          saved(1, input.content),
      );
    const { result } = renderHook(() =>
      useDocumentContent({
        documentId: "doc-1",
        load: async () => initial,
        save,
        debounceMs: DEBOUNCE,
      }),
    );
    await settle();

    act(() => result.current.change({ text: "Retry me" }));
    await wait();
    expect(result.current.status).toBe("error");
    expect(result.current.saveError).toBe("Storage is down");

    await act(async () => {
      result.current.retrySave();
      await Promise.resolve();
    });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  it("pauses automatic saving after a conflict", async () => {
    const save = vi.fn(async () => {
      throw new ApiClientError("Changed elsewhere", 409, "content_conflict");
    });
    const { result } = renderHook(() =>
      useDocumentContent({
        documentId: "doc-1",
        load: async () => initial,
        save,
        debounceMs: DEBOUNCE,
      }),
    );
    await settle();

    act(() => result.current.change({ text: "Mine" }));
    await wait();
    expect(result.current.status).toBe("conflict");

    await wait(80);
    expect(save).toHaveBeenCalledTimes(1);

    act(() => result.current.dismissConflict());
    expect(result.current.status).toBe("conflict");
    await wait(80);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flushes unsaved content when the page is hidden", async () => {
    const save = vi.fn(
      async (_id: string, input: { content: unknown }) =>
        saved(1, input.content),
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    const { result } = renderHook(() =>
      useDocumentContent({
        documentId: "doc-1",
        load: async () => initial,
        save,
        debounceMs: DEBOUNCE,
      }),
    );
    await settle();
    act(() => result.current.change({ text: "Leaving" }));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      "doc-1",
      { revision: 0, content: { text: "Leaving" } },
      { keepalive: true },
    );
  });
});

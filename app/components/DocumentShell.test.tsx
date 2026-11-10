// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Document } from "@/lib/documents/types";
import { ApiClientError } from "../lib/api-client";
import { DocumentShell } from "./DocumentShell";

vi.mock("./EditorSurface", () => ({
  EditorSurface: ({
    type,
    onChange,
  }: {
    type: string;
    onChange?: (content: unknown) => void;
  }) => (
    <div data-testid={`mock-editor-${type}`}>
      <button type="button" onClick={() => onChange?.({ text: "Hello" })}>
        Edit content
      </button>
    </div>
  ),
}));

const document: Document = {
  id: "word-1",
  name: "Lesson plan",
  type: "word",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const initialContent = {
  documentId: "word-1",
  revision: 0,
  content: { text: "" },
  updatedAt: null,
};

function renderShell(overrides: {
  loadContent?: (id: string) => Promise<typeof initialContent>;
  saveContent?: (
    id: string,
    input: { revision: number; content: unknown },
  ) => Promise<typeof initialContent>;
} = {}) {
  return render(
    <DocumentShell
      document={document}
      onRename={vi.fn(async () => undefined)}
      onDelete={vi.fn(async () => undefined)}
      loadContent={overrides.loadContent ?? (async () => initialContent)}
      saveContent={
        overrides.saveContent ??
        (async (_id, input) => ({
          ...initialContent,
          revision: 1,
          content: input.content,
        }))
      }
      debounceMs={20}
    />,
  );
}

async function wait(ms = 40) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentShell", () => {
  it("shows a content loading state while the editor content is read", () => {
    renderShell({ loadContent: () => new Promise(() => undefined) });
    expect(screen.getByTestId("content-loading")).toBeInTheDocument();
  });

  it("renders the editor with saved status and no read-only notice", async () => {
    renderShell();
    expect(await screen.findByTestId("mock-editor-word")).toBeInTheDocument();
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
  });

  it("shows a recoverable content load error", async () => {
    const loadContent = vi
      .fn<(id: string) => Promise<typeof initialContent>>()
      .mockRejectedValueOnce(new Error("Storage is unavailable"))
      .mockResolvedValueOnce(initialContent);

    renderShell({ loadContent });

    expect(await screen.findByTestId("content-error")).toHaveTextContent(
      "Storage is unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("mock-editor-word")).toBeInTheDocument();
    expect(loadContent).toHaveBeenCalledTimes(2);
  });

  it("moves through unsaved, saving, and saved states", async () => {
    let resolveSave: (value: typeof initialContent) => void = () => undefined;
    const saveContent = vi.fn(
      (_id: string, input: { revision: number; content: unknown }) =>
        new Promise<typeof initialContent>((resolve) => {
          resolveSave = () =>
            resolve({ ...initialContent, revision: 1, content: input.content });
        }),
    );

    renderShell({ saveContent });
    await screen.findByTestId("mock-editor-word");

    fireEvent.click(screen.getByRole("button", { name: "Edit content" }));
    expect(screen.getByTestId("save-status")).toHaveTextContent(
      "Unsaved changes",
    );

    await wait(30);
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saving…");

    await act(async () => {
      resolveSave({ ...initialContent, revision: 1 });
      await Promise.resolve();
    });
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
  });

  it("shows a failed save and retries", async () => {
    const saveContent = vi
      .fn()
      .mockRejectedValueOnce(new Error("Storage is down"))
      .mockImplementation(
        async (_id: string, input: { revision: number; content: unknown }) => ({
          ...initialContent,
          revision: 1,
          content: input.content,
        }),
      );

    renderShell({ saveContent });
    await screen.findByTestId("mock-editor-word");

    fireEvent.click(screen.getByRole("button", { name: "Edit content" }));
    await wait();
    expect(await screen.findByText("Save failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(saveContent).toHaveBeenCalledTimes(2);
  });

  it("asks before reloading content after a conflict", async () => {
    const loadContent = vi.fn(async () => initialContent);
    const saveContent = vi.fn(async () => {
      throw new ApiClientError("Changed elsewhere", 409, "content_conflict");
    });

    renderShell({ loadContent, saveContent });
    await screen.findByTestId("mock-editor-word");

    fireEvent.click(screen.getByRole("button", { name: "Edit content" }));
    await wait();
    expect(await screen.findByText("Changed elsewhere")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(
      screen.getByRole("heading", { name: "This document changed elsewhere" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Keep my changes" }),
    );
    expect(screen.getByText("Changed elsewhere")).toBeInTheDocument();
    expect(loadContent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reload latest" }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(loadContent).toHaveBeenCalledTimes(2);
  });
});

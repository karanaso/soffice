// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "@/lib/documents/types";
import { ApiClientError } from "../lib/api-client";
import { DocumentWorkspace } from "./DocumentWorkspace";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/word/word-1",
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

const wordDocument: Document = {
  id: "word-1",
  name: "Lesson plan",
  type: "word",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T10:30:00.000Z",
};

const excelDocument: Document = {
  ...wordDocument,
  id: "excel-1",
  name: "Markbook",
  type: "excel",
};

beforeEach(() => {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  window.sessionStorage.clear();
});

function renderWorkspace(overrides: {
  type?: "word" | "excel" | "powerpoint" | "drawing";
  load?: (id: string) => Promise<Document>;
  rename?: (id: string, name: string) => Promise<Document>;
  remove?: (id: string) => Promise<void>;
  navigate?: (href: string) => void;
  replace?: (href: string) => void;
} = {}) {
  return render(
    <DocumentWorkspace
      type={overrides.type ?? "word"}
      id="word-1"
      load={overrides.load ?? vi.fn(async () => wordDocument)}
      rename={overrides.rename ?? vi.fn(async () => wordDocument)}
      remove={overrides.remove ?? vi.fn(async () => undefined)}
      navigate={overrides.navigate ?? vi.fn()}
      replace={overrides.replace ?? vi.fn()}
    />,
  );
}

describe("DocumentWorkspace", () => {
  it("shows a loading state while the document is read", () => {
    renderWorkspace({
      load: () => new Promise<Document>(() => undefined),
    });
    expect(screen.getByTestId("shell-loading")).toHaveTextContent(
      "Loading document…",
    );
  });

  it("renders the shell with the read-only notice and correct surface", async () => {
    renderWorkspace();
    expect(
      await screen.findByRole("heading", { name: "Lesson plan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Editing tools for Word are not available in this release. This document is read-only.",
    );
    expect(screen.getByTestId("surface-word")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Library" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(window.sessionStorage.getItem("soffice:last-document:word")).toBe(
      "word-1",
    );
    expect(window.document.title).toContain("Lesson plan");
  });

  it("shows a recoverable error and retries", async () => {
    const load = vi
      .fn<(id: string) => Promise<Document>>()
      .mockRejectedValueOnce(new Error("Storage is unavailable"))
      .mockResolvedValueOnce(wordDocument);

    renderWorkspace({ load });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Storage is unavailable",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: "Lesson plan" }),
    ).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows a not-found state for a deleted document", async () => {
    renderWorkspace({
      load: async () => {
        throw new ApiClientError("Document not found.", 404, "not_found");
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Document not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Library" }),
    ).toHaveAttribute("href", "/");
  });

  it("redirects to the correct workspace when the type does not match", async () => {
    const replace = vi.fn();
    renderWorkspace({
      type: "word",
      load: async () => excelDocument,
      replace,
    });

    await vi.waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/excel/excel-1");
    });
  });

  it("updates the title and shell after a rename", async () => {
    const renamed = { ...wordDocument, name: "Lesson plan v2" };
    const rename = vi.fn(async () => renamed);
    renderWorkspace({ rename });

    await screen.findByRole("heading", { name: "Lesson plan" });
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Name");
    await userEvent.clear(input);
    await userEvent.type(input, "Lesson plan v2");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(rename).toHaveBeenCalledWith("word-1", "Lesson plan v2");
    expect(
      await screen.findByRole("heading", { name: "Lesson plan v2" }),
    ).toBeInTheDocument();
    expect(window.document.title).toContain("Lesson plan v2");
  });

  it("deletes the open document and returns to the library", async () => {
    const remove = vi.fn(async () => undefined);
    const navigate = vi.fn();
    renderWorkspace({ remove, navigate });

    await screen.findByRole("heading", { name: "Lesson plan" });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("heading", { name: "Delete “Lesson plan”?" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete document" }),
    );

    expect(remove).toHaveBeenCalledWith("word-1");
    expect(navigate).toHaveBeenCalledWith("/");
  });
});

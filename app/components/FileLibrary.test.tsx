// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "@/lib/documents/types";
import { FileLibrary } from "./FileLibrary";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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
  id: "excel-1",
  name: "Markbook",
  type: "excel",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T10:30:00.000Z",
};

beforeEach(() => {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  window.sessionStorage.clear();
});

describe("FileLibrary", () => {
  it("shows a loading state while documents are fetched", () => {
    const load = vi.fn(() => new Promise<Document[]>(() => undefined));
    render(<FileLibrary load={load} navigate={vi.fn()} />);
    expect(screen.getByText("Loading documents…")).toBeInTheDocument();
  });

  it("lists documents in the order supplied with type and modified time", async () => {
    render(
      <FileLibrary
        load={vi.fn(async () => [excelDocument, wordDocument])}
        navigate={vi.fn()}
      />,
    );

    const list = await screen.findByTestId("document-list");
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Markbook");
    expect(items[0]).toHaveTextContent("Excel");
    expect(items[1]).toHaveTextContent("Lesson plan");
    expect(items[1]).toHaveTextContent("Word");
    expect(screen.getByTestId("document-count")).toHaveTextContent("2 files");
  });

  it("shows an empty state with a create action", async () => {
    render(<FileLibrary load={vi.fn(async () => [])} navigate={vi.fn()} />);
    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create your first document" }),
    ).toBeInTheDocument();
  });

  it("shows an error and retries loading", async () => {
    const load = vi
      .fn<() => Promise<Document[]>>()
      .mockRejectedValueOnce(new Error("Storage is down"))
      .mockResolvedValueOnce([]);

    render(<FileLibrary load={load} navigate={vi.fn()} />);

    expect(
      await screen.findByText("We could not load your files"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Storage is down");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("creates a named document and opens it", async () => {
    const create = vi.fn(async () => wordDocument);
    const navigate = vi.fn();
    const load = vi.fn(async () => [] as Document[]);

    render(<FileLibrary load={load} create={create} navigate={navigate} />);
    await screen.findByText("No documents yet");

    await userEvent.click(
      screen.getByRole("button", { name: "New document" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Type"), "word");
    await userEvent.type(screen.getByLabelText("Name (optional)"), "Lesson plan");
    await userEvent.click(
      screen.getByRole("button", { name: "Create document" }),
    );

    expect(create).toHaveBeenCalledWith({
      type: "word",
      name: "Lesson plan",
    });
    expect(navigate).toHaveBeenCalledWith("/word/word-1");
  });

  it("creates a default-named document when the name is blank", async () => {
    const create = vi.fn(async () => wordDocument);
    render(
      <FileLibrary
        load={vi.fn(async () => [])}
        create={create}
        navigate={vi.fn()}
      />,
    );
    await screen.findByText("No documents yet");

    await userEvent.click(
      screen.getByRole("button", { name: "New document" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create document" }),
    );

    expect(create).toHaveBeenCalledWith({
      type: "word",
      name: undefined,
    });
  });

  it("keeps the create dialog open when creation fails", async () => {
    const create = vi.fn(async () => {
      throw new Error("Storage is unavailable");
    });
    render(
      <FileLibrary
        load={vi.fn(async () => [])}
        create={create}
        navigate={vi.fn()}
      />,
    );
    await screen.findByText("No documents yet");

    await userEvent.click(
      screen.getByRole("button", { name: "New document" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create document" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Storage is unavailable",
    );
    expect(
      screen.getByRole("dialog", { name: "New document" }),
    ).toBeInTheDocument();
  });

  it("renames a document and updates the list", async () => {
    const updated = { ...wordDocument, name: "Lesson plan v2" };
    const rename = vi.fn(async () => updated);
    render(
      <FileLibrary
        load={vi.fn(async () => [wordDocument])}
        rename={rename}
        navigate={vi.fn()}
      />,
    );

    await screen.findByText("Lesson plan");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Name");
    await userEvent.clear(input);
    await userEvent.type(input, "  Lesson plan v2  ");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(rename).toHaveBeenCalledWith("word-1", "Lesson plan v2");
    expect(await screen.findByText("Lesson plan v2")).toBeInTheDocument();
  });

  it("shows a conflict and keeps the rename dialog open", async () => {
    const rename = vi.fn(async () => {
      throw new Error("A document with that name already exists.");
    });
    render(
      <FileLibrary
        load={vi.fn(async () => [wordDocument])}
        rename={rename}
        navigate={vi.fn()}
      />,
    );

    await screen.findByText("Lesson plan");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A document with that name already exists.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("rejects an empty rename before calling the API", async () => {
    const rename = vi.fn(async () => wordDocument);
    render(
      <FileLibrary
        load={vi.fn(async () => [wordDocument])}
        rename={rename}
        navigate={vi.fn()}
      />,
    );

    await screen.findByText("Lesson plan");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Document name cannot be empty.",
    );
    expect(rename).not.toHaveBeenCalled();
  });

  it("cancels a delete without removing the document", async () => {
    const remove = vi.fn(async () => undefined);
    render(
      <FileLibrary
        load={vi.fn(async () => [wordDocument])}
        remove={remove}
        navigate={vi.fn()}
      />,
    );

    await screen.findByText("Lesson plan");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("heading", { name: "Delete “Lesson plan”?" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText("Lesson plan")).toBeInTheDocument();
  });

  it("deletes a confirmed document and forgets its session entry", async () => {
    const remove = vi.fn(async () => undefined);
    window.sessionStorage.setItem("soffice:last-document:word", "word-1");

    render(
      <FileLibrary
        load={vi.fn(async () => [wordDocument])}
        remove={remove}
        navigate={vi.fn()}
      />,
    );

    await screen.findByText("Lesson plan");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete document" }),
    );

    expect(remove).toHaveBeenCalledWith("word-1");
    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    expect(
      window.sessionStorage.getItem("soffice:last-document:word"),
    ).toBeNull();
  });
});

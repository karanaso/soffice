// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentType } from "@/lib/documents/types";
import { WorkspaceHome } from "./WorkspaceHome";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/word",
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

function renderWorkspace(overrides: {
  load?: () => Promise<Document[]>;
  create?: (input: {
    type: DocumentType;
    name?: string;
  }) => Promise<Document>;
  readLast?: (type: DocumentType) => string | null;
  forgetLast?: (type: DocumentType, id?: string) => void;
  navigate?: (href: string) => void;
  replace?: (href: string) => void;
}) {
  const load = overrides.load ?? vi.fn(async () => [wordDocument, excelDocument]);
  return render(
    <WorkspaceHome
      type="word"
      load={load}
      create={overrides.create}
      readLast={overrides.readLast ?? vi.fn(() => null)}
      forgetLast={overrides.forgetLast ?? vi.fn()}
      navigate={overrides.navigate ?? vi.fn()}
      replace={overrides.replace ?? vi.fn()}
    />,
  );
}

describe("WorkspaceHome", () => {
  it("shows only recent documents of the workspace type", async () => {
    renderWorkspace({});
    const recent = await screen.findByTestId("workspace-recent");
    expect(recent).toHaveTextContent("Lesson plan");
    expect(recent).not.toHaveTextContent("Markbook");
  });

  it("shows an empty state when there are no documents of the type", async () => {
    renderWorkspace({ load: vi.fn(async () => [excelDocument]) });
    expect(await screen.findByTestId("workspace-empty")).toHaveTextContent(
      "No Word documents yet",
    );
  });

  it("restores a valid last document by replacing the address", async () => {
    const replace = vi.fn();
    renderWorkspace({
      readLast: vi.fn(() => "word-1"),
      replace,
    });

    await vi.waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/word/word-1");
    });
  });

  it("forgets a stale stored id and shows the workspace", async () => {
    const forgetLast = vi.fn();
    renderWorkspace({
      readLast: vi.fn(() => "deleted-document"),
      forgetLast,
    });

    expect(await screen.findByTestId("workspace-recent")).toBeInTheDocument();
    expect(forgetLast).toHaveBeenCalledWith("word");
  });

  it("creates a document from the workspace and opens it", async () => {
    const create = vi.fn(async () => wordDocument);
    const navigate = vi.fn();
    renderWorkspace({
      load: vi.fn(async () => []),
      create,
      navigate,
    });

    await screen.findByTestId("workspace-empty");
    await userEvent.click(
      screen.getByRole("button", { name: "New Word document" }),
    );
    const nameInput = screen.getByLabelText("Name (optional)");
    await userEvent.type(nameInput, "New lesson");
    expect(nameInput).toHaveValue("New lesson");
    await userEvent.click(
      screen.getByRole("button", { name: "Create document" }),
    );

    expect(create).toHaveBeenCalledWith({
      type: "word",
      name: "New lesson",
    });
    expect(navigate).toHaveBeenCalledWith("/word/word-1");
  });
});

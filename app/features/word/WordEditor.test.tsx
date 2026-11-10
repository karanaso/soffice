// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorProps } from "@/app/components/editor-contract";
import { WordEditor } from "./WordEditor";
import { wordDocumentToHtml } from "@/lib/features/word/dom";
import type { WordDocument } from "@/lib/features/word/content";

const saved: WordDocument = {
  blocks: [
    {
      type: "paragraph",
      style: "h1",
      runs: [{ text: "Lesson plan" }],
    },
    {
      type: "paragraph",
      style: "normal",
      runs: [
        { text: "Bring " },
        { text: "pencils", bold: true },
        { text: " and paper." },
      ],
    },
    {
      type: "bullets",
      items: [[{ text: "Warm up" }], [{ text: "Read", italic: true }]],
    },
  ],
};

const execCommand = vi.fn();

function renderEditor(overrides: Partial<EditorProps> = {}) {
  const onChange = vi.fn();
  const props: EditorProps = {
    documentId: "doc-1",
    initialContent: saved,
    onChange,
    ...overrides,
  };
  const view = render(<WordEditor {...props} />);
  return { ...view, onChange, props };
}

function pasteEvent(plain: string, html = ""): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (type: string) => {
        if (type === "text/plain") {
          return plain;
        }
        if (type === "text/html") {
          return html;
        }
        return "";
      },
    },
  });
  return event;
}

beforeEach(() => {
  execCommand.mockReset();
  execCommand.mockReturnValue(true);
  document.execCommand = execCommand as unknown as typeof document.execCommand;
});

describe("WordEditor", () => {
  it("renders saved content in an editable page", () => {
    renderEditor();

    expect(screen.getByTestId("editor-word")).toBeInTheDocument();
    const page = screen.getByTestId("word-page");
    expect(page).toHaveAttribute("contenteditable", "true");
    expect(page).toHaveAccessibleName("Word document");
    expect(within(page).getByText("Lesson plan")).toBeInTheDocument();
    expect(page.querySelector("h1")).toHaveTextContent("Lesson plan");
    expect(page.querySelector("strong")).toHaveTextContent("pencils");
    expect(page.querySelectorAll("ul li")).toHaveLength(2);
  });

  it("renders an empty editable page when there is no saved content", () => {
    renderEditor({ initialContent: { blocks: [] } });

    const page = screen.getByTestId("word-page");
    expect(page).toHaveAttribute("contenteditable", "true");
    expect(page.textContent).toBe("");
    expect(page.querySelector("p br")).not.toBeNull();
  });

  it("keeps the page mounted when the host re-renders", () => {
    const { rerender, props } = renderEditor();
    const page = screen.getByTestId("word-page");

    rerender(
      <WordEditor
        {...props}
        initialContent={{
          blocks: [
            { type: "paragraph", style: "normal", runs: [{ text: "Other" }] },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("word-page")).toBe(page);
    expect(page.querySelector("h1")).toHaveTextContent("Lesson plan");
    expect(page).not.toHaveTextContent("Other");
  });

  it("reports the complete payload after typing", () => {
    const { onChange } = renderEditor();
    const page = screen.getByTestId("word-page");

    page.innerHTML = "<p>Hello <strong>world</strong></p>";
    fireEvent.input(page);

    expect(onChange).toHaveBeenLastCalledWith({
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "Hello " }, { text: "world", bold: true }],
        },
      ],
    });
  });

  it.each([
    ["Bold", "bold", undefined],
    ["Italic", "italic", undefined],
    ["Underline", "underline", undefined],
    ["Paragraph", "formatBlock", "<p>"],
    ["Heading 1", "formatBlock", "<h1>"],
    ["Heading 2", "formatBlock", "<h2>"],
    ["Heading 3", "formatBlock", "<h3>"],
    ["Bulleted list", "insertUnorderedList", undefined],
    ["Numbered list", "insertOrderedList", undefined],
    ["Undo", "undo", undefined],
    ["Redo", "redo", undefined],
  ])("runs the %s toolbar command", (label, command, value) => {
    const { onChange } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(execCommand).toHaveBeenCalledWith(command, false, value);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not fail when execCommand is unavailable", () => {
    const onChange = vi.fn();
    document.execCommand = undefined as unknown as typeof document.execCommand;

    render(
      <WordEditor
        documentId="doc-1"
        initialContent={saved}
        onChange={onChange}
      />,
    );

    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Bold" })),
    ).not.toThrow();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("word-page")).toBeInTheDocument();
  });

  it("pastes the plain text representation and discards markup", () => {
    const { onChange } = renderEditor({
      initialContent: {
        blocks: [
          { type: "paragraph", style: "normal", runs: [{ text: "Start" }] },
        ],
      },
    });
    const page = screen.getByTestId("word-page");
    execCommand.mockImplementation(
      (command: unknown, _showUi: unknown, value: unknown) => {
        if (command === "insertText" && typeof value === "string") {
          page.querySelector("p")?.appendChild(document.createTextNode(value));
        }
        return true;
      },
    );

    const event = pasteEvent("Plain <b>text</b>", "<b>Rich text</b>");
    fireEvent(page, event);

    expect(event.defaultPrevented).toBe(true);
    expect(execCommand).toHaveBeenCalledWith(
      "insertText",
      false,
      "Plain <b>text</b>",
    );
    expect(onChange).toHaveBeenLastCalledWith({
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "StartPlain <b>text</b>" }],
        },
      ],
    });
  });

  it("undoes and redoes with Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z", () => {
    const { onChange } = renderEditor();
    const page = screen.getByTestId("word-page");

    fireEvent.keyDown(page, { key: "z", ctrlKey: true });
    expect(execCommand).toHaveBeenLastCalledWith("undo", false, undefined);

    fireEvent.keyDown(page, { key: "z", ctrlKey: true, shiftKey: true });
    expect(execCommand).toHaveBeenLastCalledWith("redo", false, undefined);

    fireEvent.keyDown(page, { key: "z", metaKey: true });
    expect(execCommand).toHaveBeenLastCalledWith("undo", false, undefined);

    fireEvent.keyDown(page, { key: "y", metaKey: true });
    expect(execCommand).toHaveBeenLastCalledWith("redo", false, undefined);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("falls back to an empty document for invalid initial content", () => {
    renderEditor({ initialContent: { blocks: "nope" } });

    const page = screen.getByTestId("word-page");
    expect(page.textContent).toBe("");
    expect(screen.getByTestId("editor-word")).toBeInTheDocument();
  });

  it("exposes markup rendering used by integration tests", () => {
    expect(wordDocumentToHtml(saved)).toContain("<h1>Lesson plan</h1>");
  });
});

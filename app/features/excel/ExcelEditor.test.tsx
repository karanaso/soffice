// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Workbook } from "@/lib/features/excel/content";
import { ExcelEditor } from "./ExcelEditor";

function renderEditor(overrides: Partial<Workbook> = {}) {
  const initialContent: Workbook = {
    cells: overrides.cells ?? {},
    activeCell: overrides.activeCell ?? "A1",
  };
  const onChange = vi.fn();
  const view = render(
    <ExcelEditor
      documentId="excel-document"
      initialContent={initialContent}
      onChange={onChange}
    />,
  );
  return { ...view, onChange };
}

function address(): HTMLElement {
  return screen.getByTestId("excel-address");
}

describe("ExcelEditor grid", () => {
  it("renders the 26x100 grid, headers, active input, and formula bar", () => {
    renderEditor();

    expect(screen.getByTestId("editor-excel")).toBeInTheDocument();
    const grid = screen.getByRole("grid", { name: "Spreadsheet grid" });
    expect(
      grid.querySelectorAll('thead th[scope="col"]'),
    ).toHaveLength(26);
    expect(
      grid.querySelectorAll('tbody th[scope="row"]'),
    ).toHaveLength(100);
    expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(2600);
    expect(address()).toHaveTextContent("A1");
    expect(screen.getByLabelText("Cell A1")).toHaveValue("");
    expect(screen.getByLabelText("Formula bar")).toHaveValue("");
  });

  it("selects a cell with a pointer and shows its raw content", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor({ cells: { B2: "7" } });

    await user.click(screen.getByTestId("cell-B2"));

    expect(address()).toHaveTextContent("B2");
    expect(screen.getByLabelText("Cell B2")).toHaveValue("7");
    expect(screen.getByLabelText("Formula bar")).toHaveValue("7");
    expect(onChange).toHaveBeenLastCalledWith({
      cells: { B2: "7" },
      activeCell: "B2",
    });
  });

  it("moves with arrows, Tab, and Shift+Tab", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.keyboard("{ArrowRight}");
    expect(address()).toHaveTextContent("B1");

    await user.keyboard("{ArrowDown}");
    expect(address()).toHaveTextContent("B2");

    await user.keyboard("{Tab}");
    expect(address()).toHaveTextContent("C2");

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(address()).toHaveTextContent("B2");
  });

  it("clamps navigation at the grid boundaries", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByTestId("cell-A1"));
    await user.keyboard("{ArrowLeft}{ArrowUp}");
    expect(address()).toHaveTextContent("A1");

    await user.click(screen.getByTestId("cell-Z100"));
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(address()).toHaveTextContent("Z100");
    expect(screen.getByLabelText("Cell Z100")).toBeInTheDocument();
  });
});

describe("ExcelEditor editing", () => {
  it("commits on Enter and moves down one cell", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.type(screen.getByLabelText("Cell A1"), "5");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith({
      cells: { A1: "5" },
      activeCell: "A2",
    });
    expect(address()).toHaveTextContent("A2");
    expect(screen.getByLabelText("Cell A2")).toHaveValue("");

    await user.keyboard("{ArrowUp}");
    expect(screen.getByLabelText("Cell A1")).toHaveValue("5");
  });

  it("replaces an existing value and cancels with Escape", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor({ cells: { A1: "old" } });

    const input = screen.getByLabelText("Cell A1");
    await user.clear(input);
    await user.type(input, "cancelled");
    await user.keyboard("{Escape}");

    expect(screen.getByLabelText("Cell A1")).toHaveValue("old");
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "new");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith({
      cells: { A1: "new" },
      activeCell: "A2",
    });
  });

  it("shows formula results, recalculates dependents, and preserves the formula", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor({
      cells: { A1: "2", A2: "3", A3: "=SUM(A1:A2)" },
    });

    expect(screen.getByTestId("cell-A3")).toHaveTextContent("5");

    await user.clear(screen.getByLabelText("Cell A1"));
    await user.type(screen.getByLabelText("Cell A1"), "10");
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("cell-A3")).toHaveTextContent("13");
    expect(onChange).toHaveBeenLastCalledWith({
      cells: { A1: "10", A2: "3", A3: "=SUM(A1:A2)" },
      activeCell: "A2",
    });

    await user.click(screen.getByTestId("cell-A3"));
    expect(screen.getByLabelText("Cell A3")).toHaveValue("=SUM(A1:A2)");
    expect(screen.getByLabelText("Formula bar")).toHaveValue("=SUM(A1:A2)");
  });

  it("shows formula errors in the cell while keeping the formula text", async () => {
    const user = userEvent.setup();
    renderEditor({ cells: { A1: "0", B1: "=1/A1" } });

    expect(screen.getByTestId("cell-B1")).toHaveTextContent("#DIV/0!");

    await user.click(screen.getByTestId("cell-B1"));
    expect(screen.getByLabelText("Cell B1")).toHaveValue("=1/A1");
    expect(screen.getByLabelText("Formula bar")).toHaveValue("=1/A1");
  });
});

describe("ExcelEditor undo and redo", () => {
  it("undoes and redoes cell edits and recalculates dependents", async () => {
    const user = userEvent.setup();
    renderEditor({ cells: { A1: "1", B1: "=A1+1" } });

    await user.clear(screen.getByLabelText("Cell A1"));
    await user.type(screen.getByLabelText("Cell A1"), "5");
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("cell-B1")).toHaveTextContent("6");
    expect(screen.getByTestId("excel-undo")).toBeEnabled();

    await user.click(screen.getByTestId("excel-undo"));
    expect(screen.getByTestId("cell-A1")).toHaveTextContent("1");
    expect(screen.getByTestId("cell-B1")).toHaveTextContent("2");

    expect(screen.getByTestId("excel-redo")).toBeEnabled();
    await user.click(screen.getByTestId("excel-redo"));
    expect(screen.getByTestId("cell-A1")).toHaveTextContent("5");
    expect(screen.getByTestId("cell-B1")).toHaveTextContent("6");
  });

  it("discards redo history after a new committed edit", async () => {
    const user = userEvent.setup();
    renderEditor();

    const input = screen.getByLabelText("Cell A1");
    await user.type(input, "1");
    await user.keyboard("{Enter}");

    await user.keyboard("{ArrowUp}");
    await user.clear(screen.getByLabelText("Cell A1"));
    await user.type(screen.getByLabelText("Cell A1"), "2");
    await user.keyboard("{Enter}");

    await user.click(screen.getByTestId("excel-undo"));
    expect(screen.getByTestId("excel-redo")).toBeEnabled();

    await user.click(screen.getByTestId("cell-A1"));
    await user.clear(screen.getByLabelText("Cell A1"));
    await user.type(screen.getByLabelText("Cell A1"), "3");
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("excel-redo")).toBeDisabled();
    expect(screen.getByTestId("cell-A1")).toHaveTextContent("3");
  });

  it("supports Ctrl+Z and Ctrl+Shift+Z shortcuts", async () => {
    const user = userEvent.setup();
    renderEditor({ cells: { A1: "1" } });

    await user.clear(screen.getByLabelText("Cell A1"));
    await user.type(screen.getByLabelText("Cell A1"), "9");
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("cell-A1")).toHaveTextContent("9");

    await user.keyboard("{Control>}z{/Control}");
    expect(screen.getByTestId("cell-A1")).toHaveTextContent("1");

    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(screen.getByTestId("cell-A1")).toHaveTextContent("9");
  });
});

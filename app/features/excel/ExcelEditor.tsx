"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { EditorProps } from "../../components/editor-contract";
import {
  EXCEL_COLUMNS,
  EXCEL_ROW_COUNT,
  excelCodec,
  formatAddress,
  isFormula,
  parseAddress,
  type Workbook,
} from "@/lib/features/excel/content";
import {
  formatCellNumber,
  recalculate,
  type CellResults,
} from "@/lib/features/excel/formula";
import styles from "./ExcelEditor.module.css";

const MAX_HISTORY = 100;
const ROWS = Array.from({ length: EXCEL_ROW_COUNT }, (_, index) => index + 1);

function parseInitialWorkbook(input: unknown): Workbook {
  try {
    return excelCodec.parse(input);
  } catch {
    // The host validates before mounting. Falling back keeps the editor
    // mountable with incomplete fixtures and avoids a blank crash screen.
    return excelCodec.empty();
  }
}

function moveAddress(
  address: string,
  columnDelta: number,
  rowDelta: number,
): string {
  const parsed = parseAddress(address);
  if (!parsed) {
    return "A1";
  }
  return formatAddress(
    parsed.columnIndex + columnDelta,
    parsed.row + rowDelta,
  );
}

function trimHistory(
  snapshots: Array<Record<string, string>>,
): Array<Record<string, string>> {
  return snapshots.length > MAX_HISTORY
    ? snapshots.slice(snapshots.length - MAX_HISTORY)
    : snapshots;
}

function displayValue(
  address: string,
  cells: Record<string, string>,
  results: CellResults,
): { text: string; error: boolean } {
  const raw = cells[address] ?? "";
  if (!isFormula(raw)) {
    return { text: raw, error: false };
  }

  const result = results[address];
  if (typeof result === "number") {
    return { text: formatCellNumber(result), error: false };
  }
  return { text: result ?? "#REF!", error: true };
}

/**
 * First-draft Excel editor.
 *
 * The component owns the workbook grid after mount and reports the entire
 * `Workbook` payload through `onChange` after a cell commit, an undo/redo, or
 * an active-selection change. The shared host owns loading, saving, and the
 * save-status display.
 */
export function ExcelEditor({
  documentId,
  initialContent,
  onChange,
}: EditorProps) {
  const [initialWorkbook] = useState<Workbook>(() =>
    parseInitialWorkbook(initialContent),
  );
  const [cells, setCells] = useState<Record<string, string>>(
    () => initialWorkbook.cells,
  );
  const [activeCell, setActiveCell] = useState(initialWorkbook.activeCell);
  const [draft, setDraft] = useState(
    () => initialWorkbook.cells[initialWorkbook.activeCell] ?? "",
  );
  const [past, setPast] = useState<Array<Record<string, string>>>([]);
  const [future, setFuture] = useState<Array<Record<string, string>>>([]);

  const cellsRef = useRef(cells);
  const activeRef = useRef(activeCell);
  const draftRef = useRef(draft);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => recalculate(cells), [cells]);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, [activeCell]);

  function updateCells(next: Record<string, string>) {
    cellsRef.current = next;
    setCells(next);
  }

  function updateActive(next: string) {
    activeRef.current = next;
    setActiveCell(next);
  }

  function updateDraft(next: string) {
    draftRef.current = next;
    setDraft(next);
  }

  function recordHistory(previous: Record<string, string>) {
    setPast((current) => trimHistory([...current, previous]));
    setFuture([]);
  }

  function committedCells(): {
    nextCells: Record<string, string>;
    changed: boolean;
  } {
    const current = cellsRef.current;
    const address = activeRef.current;
    const value = draftRef.current;
    if (value === (current[address] ?? "")) {
      return { nextCells: current, changed: false };
    }

    const nextCells = { ...current };
    if (value === "") {
      delete nextCells[address];
    } else {
      nextCells[address] = value;
    }
    return { nextCells, changed: true };
  }

  function commitOnBlur() {
    const { nextCells, changed } = committedCells();
    if (!changed) {
      return;
    }
    recordHistory(cellsRef.current);
    updateCells(nextCells);
    onChange({ cells: nextCells, activeCell: activeRef.current });
  }

  function commitAndMove(columnDelta: number, rowDelta: number) {
    const previousAddress = activeRef.current;
    const { nextCells, changed } = committedCells();
    const nextAddress = moveAddress(previousAddress, columnDelta, rowDelta);

    if (!changed && nextAddress === previousAddress) {
      return;
    }
    if (changed) {
      recordHistory(cellsRef.current);
      updateCells(nextCells);
    }

    updateActive(nextAddress);
    updateDraft(nextCells[nextAddress] ?? "");
    onChange({ cells: nextCells, activeCell: nextAddress });
  }

  function selectCell(address: string) {
    if (address === activeRef.current) {
      inputRef.current?.focus();
      return;
    }

    updateActive(address);
    updateDraft(cellsRef.current[address] ?? "");
    onChange({ cells: cellsRef.current, activeCell: address });
  }

  function cancelEdit() {
    updateDraft(cellsRef.current[activeRef.current] ?? "");
  }

  function undo() {
    if (past.length === 0) {
      return;
    }

    const previous = past[past.length - 1];
    const current = cellsRef.current;
    setPast(past.slice(0, -1));
    setFuture((existing) => trimHistory([...existing, current]));
    updateCells(previous);
    updateDraft(previous[activeRef.current] ?? "");
    onChange({ cells: previous, activeCell: activeRef.current });
  }

  function redo() {
    if (future.length === 0) {
      return;
    }

    const next = future[future.length - 1];
    const current = cellsRef.current;
    setFuture(future.slice(0, -1));
    setPast((existing) => trimHistory([...existing, current]));
    updateCells(next);
    updateDraft(next[activeRef.current] ?? "");
    onChange({ cells: next, activeCell: activeRef.current });
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (key === "y") {
        event.preventDefault();
        redo();
        return;
      }
    }

    switch (event.key) {
      case "Enter":
        event.preventDefault();
        commitAndMove(0, 1);
        return;
      case "Escape":
        event.preventDefault();
        cancelEdit();
        return;
      case "Tab":
        event.preventDefault();
        commitAndMove(event.shiftKey ? -1 : 1, 0);
        return;
      case "ArrowUp":
        event.preventDefault();
        commitAndMove(0, -1);
        return;
      case "ArrowDown":
        event.preventDefault();
        commitAndMove(0, 1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        commitAndMove(-1, 0);
        return;
      case "ArrowRight":
        event.preventDefault();
        commitAndMove(1, 0);
        return;
      default:
        return;
    }
  }

  return (
    <div
      className={styles.editor}
      data-testid="editor-excel"
      data-document-id={documentId}
    >
      <div className={styles.toolbar} role="toolbar" aria-label="Spreadsheet toolbar">
        <button
          type="button"
          className="button"
          data-testid="excel-undo"
          onClick={undo}
          disabled={past.length === 0}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          type="button"
          className="button"
          data-testid="excel-redo"
          onClick={redo}
          disabled={future.length === 0}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <span className={styles.gridSize}>
          {EXCEL_COLUMNS.length} columns × {EXCEL_ROW_COUNT} rows
        </span>
      </div>

      <div className={styles.formulaBar}>
        <span
          className={styles.address}
          data-testid="excel-address"
          aria-label="Active cell"
        >
          {activeCell}
        </span>
        <label className="visually-hidden" htmlFor="excel-formula-input">
          Formula bar
        </label>
        <input
          id="excel-formula-input"
          className={styles.formulaInput}
          data-testid="excel-formula-input"
          aria-label="Formula bar"
          value={draft}
          readOnly
          spellCheck={false}
        />
      </div>

      <div className={styles.gridScroller} onKeyDown={handleGridKeyDown}>
        <table
          className={styles.grid}
          data-testid="excel-grid"
          role="grid"
          aria-label="Spreadsheet grid"
        >
          <thead>
            <tr>
              <th className={styles.corner} aria-hidden="true" />
              {EXCEL_COLUMNS.map((column) => (
                <th key={column} scope="col" className={styles.columnHeader}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row}>
                <th scope="row" className={styles.rowHeader}>
                  {row}
                </th>
                {EXCEL_COLUMNS.map((column) => {
                  const address = `${column}${row}`;
                  const active = address === activeCell;
                  const display = displayValue(address, cells, results);
                  return (
                    <td
                      key={address}
                      role="gridcell"
                      aria-label={address}
                      aria-selected={active}
                      data-testid={`cell-${address}`}
                      className={`${styles.cell} ${
                        active ? styles.activeCell : ""
                      }`}
                      onClick={() => selectCell(address)}
                    >
                      {active ? (
                        <input
                          ref={inputRef}
                          className={styles.cellInput}
                          aria-label={`Cell ${address}`}
                          data-testid="excel-active-input"
                          value={draft}
                          onChange={(event) =>
                            updateDraft(event.currentTarget.value)
                          }
                          onBlur={commitOnBlur}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      ) : (
                        <span
                          className={`${styles.cellValue} ${
                            display.error ? styles.error : ""
                          }`}
                          title={display.text}
                        >
                          {display.text}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

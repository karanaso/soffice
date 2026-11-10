"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";
import type { EditorProps } from "@/app/components/editor-contract";
import { wordCodec, type WordDocument } from "@/lib/features/word/content";
import {
  renderWordDocument,
  serializeWordDocument,
} from "@/lib/features/word/dom";
import styles from "./WordEditor.module.css";

function runExecCommand(command: string, value?: string): boolean {
  if (
    typeof document === "undefined" ||
    typeof document.execCommand !== "function"
  ) {
    return false;
  }

  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

/** Insert plain text without execCommand, used only as a last resort. */
function insertPlainTextAtSelection(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.appendChild(document.createElement("br"));
    }
    if (line !== "") {
      fragment.appendChild(document.createTextNode(line));
    }
  });

  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function keepSelection(event: MouseEvent<HTMLButtonElement>): void {
  // Toolbar clicks must not move focus or collapse the page selection.
  event.preventDefault();
}

/**
 * Chrome can wrap a new list inside the paragraph it replaced (`<p><ul>…`).
 * That invalid nesting makes Enter split the list unpredictably, so lift the
 * list out to the page level.
 */
function normalizeLists(root: HTMLElement): void {
  root.querySelectorAll("p > ul, p > ol").forEach((list) => {
    const parent = list.parentElement;
    if (!parent || parent === root) {
      return;
    }

    const hasText = Array.from(parent.childNodes)
      .filter((node) => node !== list)
      .some((node) => (node.textContent ?? "").trim() !== "");

    if (hasText) {
      parent.after(list);
    } else {
      parent.replaceWith(list);
    }
  });
}

function placeCaretAtEndOfCurrentBlock(root: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  let node: Node | null = selection.anchorNode;
  if (node && node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }
  const block =
    node instanceof Element
      ? node.closest("li, p, h1, h2, h3")
      : null;
  if (!block || !root.contains(block)) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

const BLOCK_STYLES = [
  {
    style: "p",
    label: "Paragraph",
    text: "P",
    command: "formatBlock",
    value: "<p>",
  },
  {
    style: "h1",
    label: "Heading 1",
    text: "H1",
    command: "formatBlock",
    value: "<h1>",
  },
  {
    style: "h2",
    label: "Heading 2",
    text: "H2",
    command: "formatBlock",
    value: "<h2>",
  },
  {
    style: "h3",
    label: "Heading 3",
    text: "H3",
    command: "formatBlock",
    value: "<h3>",
  },
] as const;

/**
 * The Word editor surface. Mount it directly with an `EditorProps` payload; it
 * owns all editing DOM and reports the complete block model through
 * `onChange` after input, formatting, paste, undo, and redo.
 */
export function WordEditor({
  documentId,
  initialContent,
  onChange,
}: EditorProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const initializedRef = useRef(false);
  const initialContentRef = useRef(initialContent);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize once. The host remounts with a new key instead of replacing
  // content underneath the user's caret.
  useEffect(() => {
    const page = pageRef.current;
    if (!page || initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    let content: WordDocument;
    try {
      content = wordCodec.parse(initialContentRef.current);
    } catch {
      content = wordCodec.empty();
    }
    renderWordDocument(page, content);
  }, []);

  useEffect(() => {
    const rememberSelection = () => {
      const page = pageRef.current;
      const selection = window.getSelection();
      if (!page || !selection || selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (page.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    };

    document.addEventListener("selectionchange", rememberSelection);
    return () =>
      document.removeEventListener("selectionchange", rememberSelection);
  }, []);

  const emitChange = useCallback(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }
    onChangeRef.current(serializeWordDocument(page));
  }, []);

  const focusPage = useCallback(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }

    page.focus();
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const saved = savedRangeRef.current;
    if (saved && page.contains(saved.commonAncestorContainer)) {
      try {
        selection.removeAllRanges();
        selection.addRange(saved);
        return;
      } catch {
        savedRangeRef.current = null;
      }
    }

    if (
      selection.rangeCount > 0 &&
      page.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(page);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const runCommand = useCallback(
    (command: string, value?: string) => {
      focusPage();
      const applied = runExecCommand(command, value);
      if (
        applied &&
        (command === "insertUnorderedList" || command === "insertOrderedList")
      ) {
        const page = pageRef.current;
        if (page) {
          normalizeLists(page);
          placeCaretAtEndOfCurrentBlock(page);
        }
      }
      emitChange();
      return applied;
    },
    [emitChange, focusPage],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        runCommand(event.shiftKey ? "redo" : "undo");
      } else if (key === "y") {
        event.preventDefault();
        runCommand("redo");
      }
    },
    [runCommand],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      event.preventDefault();
      if (text === "") {
        return;
      }

      // Only text/plain is read, so pasted fonts, colours, and layout are
      // dropped before the content reaches the block model.
      const plain = text.replace(/\r\n?/g, "\n");
      const inserted = runExecCommand("insertText", plain);
      if (!inserted) {
        insertPlainTextAtSelection(plain);
      }
      emitChange();
    },
    [emitChange],
  );

  return (
    <div
      className={styles.editor}
      data-testid="editor-word"
      data-document-id={documentId}
    >
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Word formatting"
        data-testid="word-toolbar"
      >
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={styles.toolbarButton}
            aria-label="Bold"
            title="Bold"
            onMouseDown={keepSelection}
            onClick={() => runCommand("bold")}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            aria-label="Italic"
            title="Italic"
            onMouseDown={keepSelection}
            onClick={() => runCommand("italic")}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            aria-label="Underline"
            title="Underline"
            onMouseDown={keepSelection}
            onClick={() => runCommand("underline")}
          >
            <u>U</u>
          </button>
        </div>

        <span className={styles.toolbarSeparator} aria-hidden="true" />

        <div className={styles.toolbarGroup}>
          {BLOCK_STYLES.map((block) => (
            <button
              key={block.style}
              type="button"
              className={styles.toolbarButton}
              aria-label={block.label}
              title={block.label}
              onMouseDown={keepSelection}
              onClick={() => runCommand(block.command, block.value)}
            >
              {block.text}
            </button>
          ))}
        </div>

        <span className={styles.toolbarSeparator} aria-hidden="true" />

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={styles.toolbarButton}
            aria-label="Bulleted list"
            title="Bulleted list"
            onMouseDown={keepSelection}
            onClick={() => runCommand("insertUnorderedList")}
          >
            • List
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            aria-label="Numbered list"
            title="Numbered list"
            onMouseDown={keepSelection}
            onClick={() => runCommand("insertOrderedList")}
          >
            1. List
          </button>
        </div>

        <span className={styles.toolbarSeparator} aria-hidden="true" />

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={styles.toolbarButton}
            aria-label="Undo"
            title="Undo"
            onMouseDown={keepSelection}
            onClick={() => runCommand("undo")}
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            aria-label="Redo"
            title="Redo"
            onMouseDown={keepSelection}
            onClick={() => runCommand("redo")}
          >
            Redo
          </button>
        </div>
      </div>

      <div className={styles.paperFrame}>
        <div
          ref={pageRef}
          className={styles.page}
          data-testid="word-page"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Word document"
          spellCheck
          onInput={emitChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
      </div>
    </div>
  );
}

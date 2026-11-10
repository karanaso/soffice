import type { ParagraphStyle, Run, WordBlock, WordDocument } from "./content";

type Marks = Pick<Run, "bold" | "italic" | "underline">;

type InlineWalkOptions = {
  /** Skip nested lists when collecting the inline content of a list item. */
  skipLists?: boolean;
};

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DIV",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "HEADER",
  "MAIN",
  "NAV",
  "P",
  "PRE",
  "SECTION",
]);

const LIST_TAGS = new Set(["OL", "UL"]);

const INLINE_TAGS = new Set([
  "A",
  "ABBR",
  "B",
  "CITE",
  "CODE",
  "EM",
  "FONT",
  "I",
  "MARK",
  "S",
  "SMALL",
  "SPAN",
  "STRIKE",
  "STRONG",
  "SUB",
  "SUP",
  "U",
]);

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === 1;
}

function isText(node: Node): node is Text {
  return node.nodeType === 3;
}

function tagName(element: Element): string {
  return element.tagName.toUpperCase();
}

function marksForElement(element: HTMLElement): Marks {
  const marks: Marks = {};
  const tag = tagName(element);

  if (tag === "B" || tag === "STRONG") {
    marks.bold = true;
  }
  if (tag === "I" || tag === "EM") {
    marks.italic = true;
  }
  if (tag === "U") {
    marks.underline = true;
  }

  const style = element.style;
  if (!style) {
    return marks;
  }

  const weight = style.fontWeight.trim().toLowerCase();
  if (weight === "bold" || weight === "bolder") {
    marks.bold = true;
  } else if (/^-?\d+$/.test(weight) && Number(weight) >= 600) {
    marks.bold = true;
  }

  const fontStyle = style.fontStyle.trim().toLowerCase();
  if (fontStyle === "italic" || fontStyle === "oblique") {
    marks.italic = true;
  }

  const decoration = `${style.textDecoration} ${style.textDecorationLine}`;
  if (decoration.toLowerCase().includes("underline")) {
    marks.underline = true;
  }

  return marks;
}

function makeRun(text: string, marks: Marks): Run {
  const run: Run = { text };
  if (marks.bold) {
    run.bold = true;
  }
  if (marks.italic) {
    run.italic = true;
  }
  if (marks.underline) {
    run.underline = true;
  }
  return run;
}

function hasSameMarks(left: Run, right: Run): boolean {
  return (
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline)
  );
}

/** Join adjacent runs that carry the same formatting. */
export function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    if (run.text === "") {
      continue;
    }
    const previous = merged[merged.length - 1];
    if (previous && hasSameMarks(previous, run)) {
      previous.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function extractInlineRuns(
  node: Node,
  inherited: Marks,
  options: InlineWalkOptions = {},
): Run[] {
  if (isText(node)) {
    return node.data === "" ? [] : [makeRun(node.data, inherited)];
  }

  if (!isElement(node)) {
    return [];
  }

  const tag = tagName(node);
  if (tag === "BR") {
    return [makeRun("\n", inherited)];
  }
  if (options.skipLists && LIST_TAGS.has(tag)) {
    return [];
  }

  const marks: Marks = { ...inherited, ...marksForElement(node) };
  const runs: Run[] = [];
  for (const child of Array.from(node.childNodes)) {
    runs.push(...extractInlineRuns(child, marks, options));
  }
  return runs;
}

function paragraphStyleForTag(tag: string): ParagraphStyle {
  if (tag === "H1" || tag === "H2" || tag === "H3") {
    return tag.toLowerCase() as ParagraphStyle;
  }
  return "normal";
}

/**
 * A paragraph whose only content is the browser's placeholder `<br>` is an
 * empty paragraph, not a paragraph containing a line break.
 */
function normalizeParagraphRuns(runs: Run[]): Run[] {
  if (
    runs.length === 1 &&
    runs[0].text === "\n" &&
    !runs[0].bold &&
    !runs[0].italic &&
    !runs[0].underline
  ) {
    return [];
  }
  return runs;
}

function listItems(list: Element): Run[][] {
  const items: Run[][] = [];
  for (const child of Array.from(list.children)) {
    if (tagName(child) !== "LI") {
      continue;
    }
    items.push(
      mergeRuns(
        extractInlineRuns(child, {}, { skipLists: true }),
      ),
    );
  }
  return items;
}

function appendParagraph(
  blocks: WordBlock[],
  style: ParagraphStyle,
  runs: Run[],
): void {
  blocks.push({
    type: "paragraph",
    style,
    runs: normalizeParagraphRuns(mergeRuns(runs)),
  });
}

function appendList(
  blocks: WordBlock[],
  type: "bullets" | "numbers",
  items: Run[][],
): void {
  if (items.length === 0) {
    return;
  }
  const previous = blocks[blocks.length - 1];
  if (previous && previous.type === type) {
    previous.items.push(...items);
    return;
  }
  blocks.push({ type, items });
}

/**
 * Walk the edited DOM and build the constrained Word block model.
 *
 * The serializer tolerates the markup browser editing commands produce:
 * semantic `<strong>`/`<em>`/`<u>`, legacy `<b>`/`<i>`, inline style variants,
 * `<div>` paragraphs, and consecutive list containers.
 */
export function serializeWordDocument(root: HTMLElement): WordDocument {
  const blocks: WordBlock[] = [];
  let pendingInline: Run[] = [];

  const flushInline = () => {
    if (pendingInline.length === 0) {
      return;
    }
    const runs = pendingInline;
    pendingInline = [];
    appendParagraph(blocks, "normal", runs);
  };

  for (const node of Array.from(root.childNodes)) {
    if (isText(node)) {
      if (node.data.trim() === "") {
        continue;
      }
      pendingInline.push(...extractInlineRuns(node, {}));
      continue;
    }

    if (!isElement(node)) {
      continue;
    }

    const tag = tagName(node);
    if (LIST_TAGS.has(tag)) {
      flushInline();
      appendList(
        blocks,
        tag === "UL" ? "bullets" : "numbers",
        listItems(node),
      );
      continue;
    }

    if (tag === "BR") {
      pendingInline.push(makeRun("\n", {}));
      continue;
    }

    if (BLOCK_TAGS.has(tag)) {
      flushInline();
      appendParagraph(
        blocks,
        paragraphStyleForTag(tag),
        extractInlineRuns(node, {}),
      );
      continue;
    }

    if (INLINE_TAGS.has(tag)) {
      pendingInline.push(...extractInlineRuns(node, {}));
      continue;
    }

    // Unknown block-level markup (for example pasted sections) is reduced to
    // the supported paragraph model instead of being preserved verbatim.
    flushInline();
    appendParagraph(blocks, "normal", extractInlineRuns(node, {}));
  }

  flushInline();

  if (
    blocks.length === 1 &&
    blocks[0].type === "paragraph" &&
    blocks[0].style === "normal" &&
    blocks[0].runs.length === 0
  ) {
    return { blocks: [] };
  }

  return { blocks };
}

function appendRuns(
  ownerDocument: Document,
  parent: Node,
  runs: Run[],
): void {
  for (const run of runs) {
    const content = ownerDocument.createDocumentFragment();
    const lines = run.text.split("\n");
    lines.forEach((line, index) => {
      if (index > 0) {
        content.appendChild(ownerDocument.createElement("br"));
      }
      if (line !== "") {
        content.appendChild(ownerDocument.createTextNode(line));
      }
    });

    let node: Node = content;
    if (run.underline) {
      const underline = ownerDocument.createElement("u");
      underline.appendChild(node);
      node = underline;
    }
    if (run.italic) {
      const italic = ownerDocument.createElement("em");
      italic.appendChild(node);
      node = italic;
    }
    if (run.bold) {
      const bold = ownerDocument.createElement("strong");
      bold.appendChild(node);
      node = bold;
    }
    parent.appendChild(node);
  }
}

function renderBlock(ownerDocument: Document, block: WordBlock): Node {
  if (block.type === "paragraph") {
    const element = ownerDocument.createElement(
      block.style === "normal" ? "p" : block.style,
    );
    appendRuns(ownerDocument, element, block.runs);
    if (block.runs.length === 0) {
      element.appendChild(ownerDocument.createElement("br"));
    }
    return element;
  }

  const list = ownerDocument.createElement(
    block.type === "bullets" ? "ul" : "ol",
  );
  for (const item of block.items) {
    const listItem = ownerDocument.createElement("li");
    appendRuns(ownerDocument, listItem, item);
    if (item.length === 0) {
      listItem.appendChild(ownerDocument.createElement("br"));
    }
    list.appendChild(listItem);
  }
  return list;
}

/**
 * Replace the editable page's children with the rendered block model. An empty
 * document still gets one empty paragraph so the caret is available.
 */
export function renderWordDocument(
  root: HTMLElement,
  document: WordDocument,
): void {
  const ownerDocument = root.ownerDocument ?? globalThis.document;
  root.replaceChildren();

  const blocks: WordBlock[] =
    document.blocks.length > 0
      ? document.blocks
      : [{ type: "paragraph", style: "normal", runs: [] }];

  for (const block of blocks) {
    root.appendChild(renderBlock(ownerDocument, block));
  }
}

/** Convenience export for hosts that need markup rather than a live node. */
export function wordDocumentToHtml(document: WordDocument): string {
  const container = globalThis.document.createElement("div");
  renderWordDocument(container, document);
  return container.innerHTML;
}

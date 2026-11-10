// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { WordDocument } from "./content";
import {
  mergeRuns,
  renderWordDocument,
  serializeWordDocument,
  wordDocumentToHtml,
} from "./dom";

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement("div");
});

describe("renderWordDocument", () => {
  it("creates one editable paragraph for an empty document", () => {
    renderWordDocument(root, { blocks: [] });

    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild?.tagName).toBe("P");
    expect(root.querySelector("br")).not.toBeNull();
  });

  it("renders paragraphs, heading styles, and line breaks", () => {
    const document: WordDocument = {
      blocks: [
        { type: "paragraph", style: "normal", runs: [{ text: "Intro" }] },
        { type: "paragraph", style: "h1", runs: [{ text: "Title" }] },
        { type: "paragraph", style: "h2", runs: [{ text: "Section" }] },
        { type: "paragraph", style: "h3", runs: [{ text: "Detail" }] },
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "First\nsecond" }],
        },
      ],
    };

    renderWordDocument(root, document);

    expect(root.querySelector("p")?.textContent).toBe("Intro");
    expect(root.querySelector("h1")?.textContent).toBe("Title");
    expect(root.querySelector("h2")?.textContent).toBe("Section");
    expect(root.querySelector("h3")?.textContent).toBe("Detail");
    expect(root.querySelectorAll("br")).toHaveLength(1);
  });

  it("renders bold, italic, and underline runs", () => {
    renderWordDocument(root, {
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [
            { text: "bold", bold: true },
            { text: "italic", italic: true },
            { text: "under", underline: true },
            { text: "all", bold: true, italic: true, underline: true },
          ],
        },
      ],
    });

    expect(root.querySelector("strong")?.textContent).toBe("bold");
    expect(root.querySelector("em")?.textContent).toBe("italic");
    expect(root.querySelector("u")?.textContent).toBe("under");
    expect(root.querySelector("strong em u")?.textContent).toBe("all");
  });

  it("renders bulleted and numbered lists as list items", () => {
    renderWordDocument(root, {
      blocks: [
        { type: "bullets", items: [[{ text: "One" }], [{ text: "Two" }]] },
        { type: "numbers", items: [[{ text: "First" }]] },
      ],
    });

    expect(root.querySelectorAll("ul li")).toHaveLength(2);
    expect(root.querySelectorAll("ol li")).toHaveLength(1);
    expect(root.querySelector("ul li")?.textContent).toBe("One");
  });

  it("produces HTML through the convenience helper", () => {
    const html = wordDocumentToHtml({
      blocks: [
        { type: "paragraph", style: "h1", runs: [{ text: "Hello", bold: true }] },
      ],
    });

    expect(html).toBe("<h1><strong>Hello</strong></h1>");
  });
});

describe("serializeWordDocument", () => {
  it("reads paragraphs and heading styles", () => {
    root.innerHTML =
      "<p>Intro</p><h1>Title</h1><h2>Section</h2><h3>Detail</h3>";

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        { type: "paragraph", style: "normal", runs: [{ text: "Intro" }] },
        { type: "paragraph", style: "h1", runs: [{ text: "Title" }] },
        { type: "paragraph", style: "h2", runs: [{ text: "Section" }] },
        { type: "paragraph", style: "h3", runs: [{ text: "Detail" }] },
      ],
    });
  });

  it("reads semantic and legacy character formatting", () => {
    root.innerHTML =
      '<p><strong>bold</strong> <em>italic</em> <u>under</u> <b>legacy</b> <i>old</i></p>';

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [
            { text: "bold", bold: true },
            { text: " " },
            { text: "italic", italic: true },
            { text: " " },
            { text: "under", underline: true },
            { text: " " },
            { text: "legacy", bold: true },
            { text: " " },
            { text: "old", italic: true },
          ],
        },
      ],
    });
  });

  it("reads inline styles produced by editing commands", () => {
    root.innerHTML =
      '<p><span style="font-weight: 700; font-style: italic; text-decoration: underline">styled</span></p>';

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [
            { text: "styled", bold: true, italic: true, underline: true },
          ],
        },
      ],
    });
  });

  it("reads bulleted and numbered lists", () => {
    root.innerHTML =
      "<ul><li>One</li><li><strong>Two</strong></li></ul><ol><li>First</li></ol>";

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        {
          type: "bullets",
          items: [[{ text: "One" }], [{ text: "Two", bold: true }]],
        },
        { type: "numbers", items: [[{ text: "First" }]] },
      ],
    });
  });

  it("merges adjacent lists of the same type", () => {
    root.innerHTML = "<ul><li>One</li></ul><ul><li>Two</li></ul>";

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        {
          type: "bullets",
          items: [[{ text: "One" }], [{ text: "Two" }]],
        },
      ],
    });
  });

  it("ignores nested lists inside a list item", () => {
    root.innerHTML = "<ul><li>One<ul><li>Nested</li></ul></li></ul>";

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        { type: "bullets", items: [[{ text: "One" }]] },
      ],
    });
  });

  it("reads line breaks as newlines inside a run", () => {
    root.innerHTML = "<p>First<br>second</p>";

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "First\nsecond" }],
        },
      ],
    });
  });

  it("wraps stray inline content in a paragraph", () => {
    root.innerHTML = "Hello <strong>there</strong>";

    expect(serializeWordDocument(root)).toEqual({
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "Hello " }, { text: "there", bold: true }],
        },
      ],
    });
  });

  it("treats a browser placeholder break as an empty paragraph", () => {
    root.innerHTML = "<p><br></p>";

    expect(serializeWordDocument(root)).toEqual({ blocks: [] });
  });

  it("round-trips the rendered block model", () => {
    const document: WordDocument = {
      blocks: [
        {
          type: "paragraph",
          style: "h1",
          runs: [
            { text: "Title " },
            { text: "bold", bold: true },
            { text: " and ", italic: true },
            { text: "all", underline: true, bold: true },
          ],
        },
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "a\nb", bold: true }],
        },
        { type: "bullets", items: [[{ text: "One" }], [{ text: "Two" }]] },
        { type: "numbers", items: [[{ text: "First", bold: true }]] },
      ],
    };

    renderWordDocument(root, document);

    expect(serializeWordDocument(root)).toEqual(document);
  });
});

describe("mergeRuns", () => {
  it("joins adjacent runs with identical marks and drops empty runs", () => {
    expect(
      mergeRuns([
        { text: "a" },
        { text: "b" },
        { text: "" },
        { text: "c", bold: true },
        { text: "d", bold: true },
      ]),
    ).toEqual([{ text: "ab" }, { text: "cd", bold: true }]);
  });
});

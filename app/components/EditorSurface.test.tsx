// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentType } from "@/lib/documents/types";
import type { EditorProps } from "./editor-contract";
import { EditorSurface } from "./EditorSurface";

vi.mock("@/app/features/word", () => ({
  WordEditor: ({ documentId }: EditorProps) => (
    <div data-testid="editor-word" data-document-id={documentId} />
  ),
}));
vi.mock("@/app/features/excel", () => ({
  ExcelEditor: ({ documentId }: EditorProps) => (
    <div data-testid="editor-excel" data-document-id={documentId} />
  ),
}));
vi.mock("@/app/features/powerpoint", () => ({
  PowerPointEditor: ({ documentId }: EditorProps) => (
    <div data-testid="editor-powerpoint" data-document-id={documentId} />
  ),
}));
vi.mock("@/app/features/drawing", () => ({
  DrawingEditor: ({ documentId }: EditorProps) => (
    <div data-testid="editor-drawing" data-document-id={documentId} />
  ),
}));

const CASES: DocumentType[] = ["word", "excel", "powerpoint", "drawing"];

describe("EditorSurface", () => {
  it.each(CASES)("renders the %s feature editor", (type) => {
    const { container } = render(
      <EditorSurface
        type={type}
        documentId="doc-1"
        initialContent={{}}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByTestId(`editor-${type}`)).toHaveAttribute(
      "data-document-id",
      "doc-1",
    );
    expect(container.querySelector('[data-testid^="surface-"]')).toBeNull();
    expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
  });
});

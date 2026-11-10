// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DocumentType } from "@/lib/documents/types";
import { EditorSurface } from "./EditorSurface";

const CASES: Array<{
  type: DocumentType;
  testId: string;
  label: string;
}> = [
  { type: "word", testId: "surface-word", label: "Read-only Word page preview" },
  {
    type: "excel",
    testId: "surface-excel",
    label: "Read-only Excel grid preview",
  },
  {
    type: "powerpoint",
    testId: "surface-powerpoint",
    label: "Read-only PowerPoint slide preview",
  },
  {
    type: "drawing",
    testId: "surface-drawing",
    label: "Read-only Drawing canvas preview",
  },
];

describe("EditorSurface", () => {
  it.each(CASES)(
    "renders the $type placeholder surface without editing controls",
    ({ type, testId, label }) => {
      const { container } = render(<EditorSurface type={type} />);
      const surface = screen.getByTestId(testId);
      expect(surface).toBeInTheDocument();
      expect(surface).toHaveAccessibleName(label);
      expect(
        container.querySelectorAll(
          'input, textarea, button, [contenteditable="true"]',
        ),
      ).toHaveLength(0);
    },
  );

  it("renders the PowerPoint slide and drawing canvas elements", () => {
    const { rerender } = render(<EditorSurface type="powerpoint" />);
    expect(screen.getByTestId("slide-canvas")).toBeInTheDocument();

    rerender(<EditorSurface type="drawing" />);
    expect(screen.getByTestId("drawing-canvas")).toBeInTheDocument();
  });
});

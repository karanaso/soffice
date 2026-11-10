// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Drawing, Point, Stroke } from "@/lib/features/drawing/content";
import { DrawingEditor } from "./DrawingEditor";

interface MockContext {
  setTransform: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
}

let context: MockContext;
let rect: DOMRect;

function createMockContext(): MockContext {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "round",
    lineJoin: "round",
  };
}

function makeRect(width = 800, height = 450): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeStroke(
  id: string,
  points: Point[],
  overrides: Partial<Omit<Stroke, "id" | "points">> = {},
): Stroke {
  return {
    id,
    color: "#18233a",
    width: 10,
    points,
    ...overrides,
  };
}

function makeDrawing(strokes: Stroke[] = []): Drawing {
  return { width: 1600, height: 900, strokes };
}

function canvas(): HTMLCanvasElement {
  return screen.getByTestId("drawing-canvas") as HTMLCanvasElement;
}

function firePointer(
  element: HTMLCanvasElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  clientX: number,
  clientY: number,
  options: {
    pointerId?: number;
    pointerType?: string;
    button?: number;
    buttons?: number;
  } = {},
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: options.button ?? 0,
    buttons:
      options.buttons ??
      (type === "pointerup" || type === "pointercancel" ? 0 : 1),
  });
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: options.pointerId ?? 1,
  });
  Object.defineProperty(event, "pointerType", {
    configurable: true,
    value: options.pointerType ?? "mouse",
  });
  fireEvent(element, event);
}

function draw(
  element: HTMLCanvasElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: { pointerType?: string } = {},
): void {
  firePointer(element, "pointerdown", from.x, from.y, options);
  firePointer(element, "pointermove", to.x, to.y, {
    ...options,
    buttons: 1,
  });
  firePointer(element, "pointerup", to.x, to.y, {
    ...options,
    buttons: 0,
  });
}

beforeEach(() => {
  context = createMockContext();
  rect = makeRect();

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getBoundingClientRect",
  ).mockImplementation(() => rect);
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 1,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DrawingEditor", () => {
  it("renders an independently mountable editor with disabled history", () => {
    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("editor-drawing")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Drawing canvas" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Pen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Eraser" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("emits one complete payload when a pen stroke is released", () => {
    const onChange = vi.fn();
    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing()}
        onChange={onChange}
      />,
    );

    const target = canvas();
    firePointer(target, "pointerdown", 80, 45);
    firePointer(target, "pointermove", 160, 90);

    expect(onChange).not.toHaveBeenCalled();

    firePointer(target, "pointerup", 160, 90, { buttons: 0 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const payload = onChange.mock.calls[0][0] as Drawing;
    expect(payload.width).toBe(1600);
    expect(payload.height).toBe(900);
    expect(payload.strokes).toHaveLength(1);
    expect(payload.strokes[0].color).toBe("#18233a");
    expect(payload.strokes[0].width).toBe(10);
    expect(payload.strokes[0].points[0]).toEqual({ x: 160, y: 90 });
    expect(payload.strokes[0].points.at(-1)).toEqual({ x: 320, y: 180 });
    expect(payload.strokes[0].points.length).toBeGreaterThan(2);
  });

  it("adds a visible dot for a click without movement", () => {
    const onChange = vi.fn();
    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing()}
        onChange={onChange}
      />,
    );

    const target = canvas();
    firePointer(target, "pointerdown", 200, 225);
    firePointer(target, "pointerup", 200, 225, { buttons: 0 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const payload = onChange.mock.calls[0][0] as Drawing;
    expect(payload.strokes[0].points).toEqual([{ x: 400, y: 450 }]);
    expect(context.arc).toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalled();
  });

  it("draws with touch input using the same stroke model", () => {
    const onChange = vi.fn();
    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing()}
        onChange={onChange}
      />,
    );

    draw(canvas(), { x: 100, y: 100 }, { x: 140, y: 140 }, {
      pointerType: "touch",
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const payload = onChange.mock.calls[0][0] as Drawing;
    expect(payload.strokes[0].points[0]).toEqual({ x: 200, y: 200 });
  });

  it("applies the selected color and width to new strokes", () => {
    const onChange = vi.fn();
    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Color Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Thick stroke" }));

    expect(screen.getByRole("button", { name: "Color Red" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Thick stroke" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    draw(canvas(), { x: 40, y: 40 }, { x: 120, y: 80 });

    const payload = onChange.mock.calls[0][0] as Drawing;
    expect(payload.strokes[0].color).toBe("#b42318");
    expect(payload.strokes[0].width).toBe(20);
    expect(context.strokeStyle).toBe("#b42318");
    expect(context.lineWidth).toBe(20);
  });

  it("switches tools without changing the drawing", () => {
    const onChange = vi.fn();
    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing([makeStroke("one", [{ x: 100, y: 100 }])])}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
    expect(screen.getByRole("button", { name: "Eraser" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Pen" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pen" }));
    expect(screen.getByRole("button", { name: "Pen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("erases whole strokes touched by the eraser and emits once", () => {
    const onChange = vi.fn();
    const untouched = makeStroke("untouched", [
      { x: 1000, y: 200 },
      { x: 1200, y: 200 },
    ]);
    const target = makeStroke("target", [
      { x: 100, y: 450 },
      { x: 500, y: 450 },
    ]);

    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing([target, untouched])}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
    const element = canvas();
    firePointer(element, "pointerdown", 130, 225);
    firePointer(element, "pointermove", 170, 225);
    expect(onChange).not.toHaveBeenCalled();
    firePointer(element, "pointerup", 170, 225, { buttons: 0 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const payload = onChange.mock.calls[0][0] as Drawing;
    expect(payload.strokes).toHaveLength(1);
    expect(payload.strokes[0].id).toBe("untouched");
  });

  it("uses tolerance so the eraser can miss a stroke", () => {
    const onChange = vi.fn();
    const target = makeStroke("target", [
      { x: 100, y: 450 },
      { x: 500, y: 450 },
    ]);

    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing([target])}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
    const element = canvas();
    firePointer(element, "pointerdown", 150, 280);
    firePointer(element, "pointermove", 160, 280);
    firePointer(element, "pointerup", 160, 280, { buttons: 0 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears only after confirmation and can undo the clear", () => {
    const onChange = vi.fn();
    const strokes = [
      makeStroke("one", [{ x: 100, y: 100 }]),
      makeStroke("two", [{ x: 300, y: 300 }]),
    ];

    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing(strokes)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.getByRole("alertdialog", { name: "Clear the whole drawing?" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear canvas" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as Drawing).strokes).toEqual([]);
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect((onChange.mock.calls[1][0] as Drawing).strokes).toEqual(strokes);
  });

  it("leaves the drawing unchanged when clearing is cancelled", () => {
    const onChange = vi.fn();
    const strokes = [makeStroke("one", [{ x: 100, y: 100 }])];

    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing(strokes)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("undoes and redoes drawing actions and clears redo on a new action", () => {
    const onChange = vi.fn();
    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing()}
        onChange={onChange}
      />,
    );

    const element = canvas();
    draw(element, { x: 40, y: 40 }, { x: 100, y: 40 });
    draw(element, { x: 40, y: 100 }, { x: 100, y: 100 });
    expect(onChange).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect((onChange.mock.calls[2][0] as Drawing).strokes).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect((onChange.mock.calls[3][0] as Drawing).strokes).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    draw(element, { x: 40, y: 150 }, { x: 100, y: 150 });
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
    const latest = onChange.mock.calls.at(-1)?.[0] as Drawing;
    expect(latest.strokes).toHaveLength(2);
    expect(latest.strokes[1].points[0]).toEqual({ x: 80, y: 300 });
  });

  it("restores strokes from initial content without emitting a change", () => {
    const onChange = vi.fn();
    const strokes = [
      makeStroke("one", [{ x: 100, y: 100 }]),
      makeStroke("two", [{ x: 300, y: 300 }]),
    ];

    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing(strokes)}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByText(/Drawing with 2 strokes/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("button", { name: "Clear" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("scales the backing canvas by devicePixelRatio and redraws on resize", () => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });

    render(
      <DrawingEditor
        documentId="doc-1"
        initialContent={makeDrawing([makeStroke("one", [{ x: 10, y: 10 }])])}
        onChange={vi.fn()}
      />,
    );

    const element = canvas();
    expect(element.width).toBe(1600);
    expect(element.height).toBe(900);

    rect = makeRect(400, 225);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(element.width).toBe(800);
    expect(element.height).toBe(450);
    expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 800, 450);
    expect(context.setTransform).toHaveBeenLastCalledWith(
      0.5,
      0,
      0,
      0.5,
      0,
      0,
    );
  });
});

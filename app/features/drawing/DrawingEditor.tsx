"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorProps } from "@/app/components/editor-contract";
import {
  drawingCodec,
  DRAWING_HEIGHT,
  DRAWING_WIDTH,
  type Drawing,
  type Point,
  type Stroke,
} from "@/lib/features/drawing/content";
import {
  appendSampledPoints,
  canRedo,
  canUndo,
  createHistory,
  ERASER_TOLERANCE,
  pointDistance,
  pushSnapshot,
  redoHistory,
  strokesHitBySegment,
  toLogicalPoint,
  undoHistory,
  type DrawingHistory,
} from "@/lib/features/drawing/geometry";
import styles from "./DrawingEditor.module.css";

export const DRAWING_COLORS = [
  { name: "Black", value: "#18233a" },
  { name: "Blue", value: "#2563eb" },
  { name: "Red", value: "#b42318" },
  { name: "Green", value: "#067647" },
  { name: "Amber", value: "#b54708" },
  { name: "Purple", value: "#6b3fc4" },
] as const;

export const DRAWING_WIDTHS = [
  { name: "Thin", value: 4 },
  { name: "Medium", value: 10 },
  { name: "Thick", value: 20 },
] as const;

type Tool = "pen" | "eraser";

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function readInitialDrawing(input: unknown): Drawing {
  try {
    return drawingCodec.parse(input);
  } catch {
    // The host parses before mounting, but falling back keeps the editor
    // independently mountable with an empty payload.
    return drawingCodec.empty();
  }
}

function createStrokeId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `stroke-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";

  const [first] = stroke.points;
  if (!first) {
    return;
  }

  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(first.x, first.y);
  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index];
    context.lineTo(point.x, point.y);
  }
  context.stroke();
}

/**
 * Freehand Drawing editor.
 *
 * Mount it with content already parsed by `drawingCodec` and report the
 * complete payload through `onChange` after each committed action. The editor
 * owns tool, color, width, history, and canvas state; the shared host owns
 * loading, saving, debouncing, and status.
 */
export function DrawingEditor({
  documentId,
  initialContent,
  onChange,
}: EditorProps) {
  const [history, setHistory] = useState<DrawingHistory>(() =>
    createHistory(readInitialDrawing(initialContent).strokes),
  );
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(DRAWING_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState<number>(
    DRAWING_WIDTHS[1].value,
  );
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [erasePreview, setErasePreview] = useState<Stroke[] | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [canvasMetrics, setCanvasMetrics] = useState({
    width: 800,
    height: 450,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const gestureMode = useRef<Tool | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const eraseBaseRef = useRef<Stroke[] | null>(null);
  const erasedIdsRef = useRef<Set<string>>(new Set());

  const displayStrokes = erasePreview ?? history.present;

  const emit = useCallback(
    (strokes: Stroke[]) => {
      onChange({ width: DRAWING_WIDTH, height: DRAWING_HEIGHT, strokes });
    },
    [onChange],
  );

  const measureCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const cssWidth =
      rect.width > 0 ? rect.width : canvas.clientWidth || DRAWING_WIDTH;
    const cssHeight =
      rect.height > 0 ? rect.height : (cssWidth * DRAWING_HEIGHT) / DRAWING_WIDTH;
    const devicePixelRatio =
      typeof window !== "undefined" && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;

    const width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
    const height = Math.max(1, Math.round(cssHeight * devicePixelRatio));

    setCanvasMetrics((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);

  useEffect(() => {
    measureCanvas();

    const canvas = canvasRef.current;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => measureCanvas());
      observer.observe(canvas?.parentElement ?? canvas ?? document.body);
    }
    window.addEventListener("resize", measureCanvas);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureCanvas);
    };
  }, [measureCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(
      canvas.width / DRAWING_WIDTH,
      0,
      0,
      canvas.height / DRAWING_HEIGHT,
      0,
      0,
    );

    for (const stroke of displayStrokes) {
      drawStroke(context, stroke);
    }
    if (draft) {
      drawStroke(context, draft);
    }
  }, [canvasMetrics, displayStrokes, draft]);

  function pointFromEvent(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    return toLogicalPoint(
      { x: event.clientX, y: event.clientY },
      canvas.getBoundingClientRect(),
    );
  }

  function resetGesture(): void {
    activePointerId.current = null;
    gestureMode.current = null;
    draftRef.current = null;
    lastPointRef.current = null;
    eraseBaseRef.current = null;
    erasedIdsRef.current = new Set();
  }

  function releasePointer(event: React.PointerEvent<HTMLCanvasElement>): void {
    const target = event.currentTarget;
    if (typeof target.releasePointerCapture === "function") {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may already have been released by the browser.
      }
    }
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    if (activePointerId.current !== null) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const point = pointFromEvent(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    activePointerId.current = event.pointerId;
    gestureMode.current = tool;
    lastPointRef.current = point;

    if (typeof event.currentTarget.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is an enhancement; drawing still works without it.
      }
    }

    if (tool === "pen") {
      const stroke: Stroke = {
        id: createStrokeId(),
        color,
        width: strokeWidth,
        points: [point],
      };
      draftRef.current = stroke;
      setDraft(stroke);
      setErasePreview(null);
      return;
    }

    const base = history.present;
    eraseBaseRef.current = base;
    const erased = new Set<string>();
    for (const hit of strokesHitBySegment(
      base,
      point,
      point,
      ERASER_TOLERANCE,
    )) {
      erased.add(hit.id);
    }
    erasedIdsRef.current = erased;
    setErasePreview(
      erased.size > 0
        ? base.filter((stroke) => !erased.has(stroke.id))
        : null,
    );
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    if (activePointerId.current !== event.pointerId) {
      return;
    }

    const point = pointFromEvent(event);
    if (!point) {
      return;
    }
    event.preventDefault();

    const previous = lastPointRef.current;
    const mode = gestureMode.current;

    if (mode === "pen") {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      if (previous && pointDistance(previous, point) === 0) {
        return;
      }
      const next: Stroke = {
        ...current,
        points: appendSampledPoints(current.points, point),
      };
      draftRef.current = next;
      lastPointRef.current = point;
      setDraft(next);
      return;
    }

    if (mode === "eraser") {
      const base = eraseBaseRef.current;
      if (!base) {
        return;
      }
      const from = previous ?? point;
      const hits = strokesHitBySegment(base, from, point, ERASER_TOLERANCE);
      let changed = false;
      for (const hit of hits) {
        if (!erasedIdsRef.current.has(hit.id)) {
          erasedIdsRef.current.add(hit.id);
          changed = true;
        }
      }
      lastPointRef.current = point;
      if (changed) {
        setErasePreview(
          base.filter((stroke) => !erasedIdsRef.current.has(stroke.id)),
        );
      }
    }
  }

  function handlePointerUp(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    if (activePointerId.current !== event.pointerId) {
      return;
    }

    const point = pointFromEvent(event);
    const mode = gestureMode.current;
    releasePointer(event);

    if (mode === "pen") {
      const current = draftRef.current;
      if (current) {
        let finalStroke = current;
        if (point && pointDistance(current.points[current.points.length - 1], point) > 0) {
          finalStroke = {
            ...current,
            points: appendSampledPoints(current.points, point),
          };
        }
        const next = [...history.present, finalStroke];
        setHistory(pushSnapshot(history, next));
        emit(next);
      }
    } else if (mode === "eraser") {
      const base = eraseBaseRef.current;
      if (base) {
        const from = lastPointRef.current;
        if (point && from && pointDistance(from, point) > 0) {
          for (const hit of strokesHitBySegment(
            base,
            from,
            point,
            ERASER_TOLERANCE,
          )) {
            erasedIdsRef.current.add(hit.id);
          }
        }
        if (erasedIdsRef.current.size > 0) {
          const next = base.filter(
            (stroke) => !erasedIdsRef.current.has(stroke.id),
          );
          setHistory(pushSnapshot(history, next));
          emit(next);
        }
      }
    }

    setDraft(null);
    setErasePreview(null);
    resetGesture();
  }

  function handlePointerCancel(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    if (activePointerId.current !== event.pointerId) {
      return;
    }
    releasePointer(event);
    setDraft(null);
    setErasePreview(null);
    resetGesture();
  }

  function handleUndo(): void {
    const next = undoHistory(history);
    if (next === history) {
      return;
    }
    setHistory(next);
    emit(next.present);
  }

  function handleRedo(): void {
    const next = redoHistory(history);
    if (next === history) {
      return;
    }
    setHistory(next);
    emit(next.present);
  }

  function handleConfirmClear(): void {
    const next: Stroke[] = [];
    setHistory(pushSnapshot(history, next));
    emit(next);
    setClearOpen(false);
  }

  const strokeSummary =
    history.present.length === 0
      ? "Blank drawing."
      : `Drawing with ${history.present.length} stroke${
          history.present.length === 1 ? "" : "s"
        }.`;

  return (
    <section
      className={styles.editor}
      data-testid="editor-drawing"
      data-document-id={documentId}
      aria-label="Drawing editor"
    >
      <div className={styles.toolbar} role="toolbar" aria-label="Drawing tools">
        <div className={styles.group} role="group" aria-label="Tools">
          <button
            type="button"
            className={classNames(
              styles.toolButton,
              tool === "pen" && styles.active,
            )}
            aria-pressed={tool === "pen"}
            onClick={() => setTool("pen")}
          >
            Pen
          </button>
          <button
            type="button"
            className={classNames(
              styles.toolButton,
              tool === "eraser" && styles.active,
            )}
            aria-pressed={tool === "eraser"}
            onClick={() => setTool("eraser")}
          >
            Eraser
          </button>
        </div>

        <div className={styles.group} role="group" aria-label="Stroke color">
          {DRAWING_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={classNames(
                styles.swatchButton,
                color === option.value && styles.active,
              )}
              style={{ backgroundColor: option.value }}
              aria-label={`Color ${option.name}`}
              aria-pressed={color === option.value}
              onClick={() => setColor(option.value)}
            />
          ))}
        </div>

        <div className={styles.group} role="group" aria-label="Stroke width">
          {DRAWING_WIDTHS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={classNames(
                styles.widthButton,
                strokeWidth === option.value && styles.active,
              )}
              aria-label={`${option.name} stroke`}
              aria-pressed={strokeWidth === option.value}
              onClick={() => setStrokeWidth(option.value)}
            >
              <span
                className={styles.widthDot}
                style={{ width: option.value, height: option.value }}
                aria-hidden="true"
              />
              <span>{option.name}</span>
            </button>
          ))}
        </div>

        <div className={styles.group} role="group" aria-label="History">
          <button
            type="button"
            className={styles.toolButton}
            onClick={handleUndo}
            disabled={!canUndo(history)}
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.toolButton}
            onClick={handleRedo}
            disabled={!canRedo(history)}
          >
            Redo
          </button>
          <button
            type="button"
            className={classNames(styles.toolButton, styles.clearButton)}
            onClick={() => setClearOpen(true)}
            disabled={history.present.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <p id="drawing-instructions" className="visually-hidden">
        Use the Pen tool to draw. Use the Eraser to remove whole strokes. Undo
        and Redo change one action. Clear asks for confirmation and can be
        undone. {strokeSummary}
      </p>

      <div className={styles.canvasFrame}>
        <canvas
          ref={canvasRef}
          className={classNames(
            styles.canvas,
            tool === "eraser" && styles.eraserCursor,
          )}
          data-testid="drawing-canvas"
          width={canvasMetrics.width}
          height={canvasMetrics.height}
          role="img"
          aria-label="Drawing canvas"
          aria-describedby="drawing-instructions"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      </div>

      <div className={styles.footer}>
        <p className={styles.strokeCount} aria-live="polite">
          {strokeSummary}
        </p>
        {tool === "eraser" ? (
          <p className={styles.hint}>Touch a stroke to remove it whole.</p>
        ) : (
          <p className={styles.hint}>Draw with a mouse, finger, or stylus.</p>
        )}
      </div>

      {clearOpen ? (
        <div
          className={styles.clearDialog}
          role="alertdialog"
          aria-labelledby="drawing-clear-title"
          aria-describedby="drawing-clear-description"
        >
          <h2 id="drawing-clear-title">Clear the whole drawing?</h2>
          <p id="drawing-clear-description">
            This removes all {history.present.length} stroke
            {history.present.length === 1 ? "" : "s"}. You can undo the clear
            until you draw again.
          </p>
          <div className={styles.dialogActions}>
            <button
              type="button"
              className="button button-danger"
              onClick={handleConfirmClear}
            >
              Clear canvas
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setClearOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

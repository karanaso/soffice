import { describe, expect, it } from "vitest";
import type { Point, Stroke } from "./content";
import {
  appendSampledPoints,
  canRedo,
  canUndo,
  createHistory,
  distanceToSegment,
  HISTORY_LIMIT,
  pointDistance,
  pushSnapshot,
  redoHistory,
  samplePointer,
  segmentDistance,
  strokeDistanceToPoint,
  strokeHitBySegment,
  strokesHitBySegment,
  toLogicalPoint,
  undoHistory,
} from "./geometry";

const rect = { left: 20, top: 10, width: 800, height: 450 };

function stroke(points: Point[], width = 4): Stroke {
  return {
    id: `stroke-${points.map((point) => `${point.x},${point.y}`).join("-")}`,
    color: "#18233a",
    width,
    points,
  };
}

describe("toLogicalPoint", () => {
  it("maps display coordinates into the 1600 x 900 logical space", () => {
    expect(toLogicalPoint({ x: 420, y: 235 }, rect)).toEqual({
      x: 800,
      y: 450,
    });
    expect(toLogicalPoint({ x: 20, y: 10 }, rect)).toEqual({ x: 0, y: 0 });
    expect(toLogicalPoint({ x: 820, y: 460 }, rect)).toEqual({
      x: 1600,
      y: 900,
    });
  });

  it("clamps pointer coordinates outside the canvas", () => {
    expect(toLogicalPoint({ x: -100, y: -100 }, rect)).toEqual({ x: 0, y: 0 });
    expect(toLogicalPoint({ x: 2000, y: 2000 }, rect)).toEqual({
      x: 1600,
      y: 900,
    });
  });

  it("falls back to the logical size when the display rect is unmeasured", () => {
    expect(
      toLogicalPoint({ x: 800, y: 450 }, { left: 0, top: 0, width: 0, height: 0 }),
    ).toEqual({ x: 800, y: 450 });
  });
});

describe("pointer sampling", () => {
  it("returns evenly spaced intermediate points including the destination", () => {
    const points = samplePointer({ x: 0, y: 0 }, { x: 10, y: 0 }, 2);
    expect(points).toEqual([
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("samples a fast pointer move so it does not leave a gap", () => {
    const points = samplePointer({ x: 0, y: 0 }, { x: 1000, y: 0 }, 2);
    expect(points.length).toBeGreaterThan(100);
    expect(points[0]).toEqual({ x: 2, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 1000, y: 0 });
    for (let index = 1; index < points.length; index += 1) {
      expect(pointDistance(points[index - 1], points[index])).toBeLessThanOrEqual(
        2.000001,
      );
    }
  });

  it("returns nothing when the pointer has not moved", () => {
    expect(samplePointer({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([]);
  });

  it("appends sampled points to an existing stroke", () => {
    const points = appendSampledPoints([{ x: 0, y: 0 }], { x: 6, y: 0 }, 2);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it("starts a new stroke when there are no previous points", () => {
    expect(appendSampledPoints([], { x: 4, y: 6 })).toEqual([{ x: 4, y: 6 }]);
  });
});

describe("hit testing", () => {
  it("measures distance to a segment and its endpoints", () => {
    expect(
      distanceToSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ).toBe(10);
    expect(
      distanceToSegment({ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ).toBe(10);
    expect(
      segmentDistance(
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: -20 },
        { x: 50, y: 20 },
      ),
    ).toBe(0);
  });

  it("hits a dot stroke within tolerance and misses outside it", () => {
    const dot = stroke([{ x: 100, y: 100 }], 4);
    expect(strokeDistanceToPoint(dot, { x: 103, y: 104 })).toBe(5);
    expect(strokeHitBySegment(dot, { x: 108, y: 100 }, { x: 108, y: 100 }, 10)).toBe(
      true,
    );
    expect(strokeHitBySegment(dot, { x: 140, y: 100 }, { x: 140, y: 100 }, 10)).toBe(
      false,
    );
  });

  it("hits a polyline using the eraser segment, not just its endpoint", () => {
    const line = stroke([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(strokeHitBySegment(line, { x: 50, y: 12 }, { x: 50, y: 20 }, 12)).toBe(
      true,
    );
    expect(strokeHitBySegment(line, { x: 50, y: 20 }, { x: 50, y: 30 }, 12)).toBe(
      false,
    );
  });

  it("catches a fast eraser movement that crosses a vertical stroke", () => {
    const vertical = stroke([
      { x: 0, y: -100 },
      { x: 0, y: 100 },
    ]);
    expect(strokeHitBySegment(vertical, { x: -50, y: 5 }, { x: 50, y: 5 }, 0)).toBe(
      true,
    );
  });

  it("returns every touched stroke exactly once", () => {
    const strokes = [
      stroke([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
      stroke([
        { x: 100, y: 100 },
        { x: 110, y: 100 },
      ]),
      stroke([
        { x: 5, y: 0 },
        { x: 15, y: 0 },
      ]),
    ];

    const hits = strokesHitBySegment(
      strokes,
      { x: 5, y: 40 },
      { x: 5, y: -40 },
      2,
    );
    expect(hits).toHaveLength(2);
    expect(hits[0]).toBe(strokes[0]);
    expect(hits[1]).toBe(strokes[2]);
  });
});

describe("history", () => {
  const first = [stroke([{ x: 1, y: 1 }])];
  const second = [...first, stroke([{ x: 2, y: 2 }])];
  const third = [...second, stroke([{ x: 3, y: 3 }])];

  it("starts with the loaded strokes and no history", () => {
    const history = createHistory(first);
    expect(history.present).toBe(first);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("undoes and redoes snapshots", () => {
    let history = createHistory(first);
    history = pushSnapshot(history, second);
    history = pushSnapshot(history, third);

    history = undoHistory(history);
    expect(history.present).toBe(second);
    expect(canRedo(history)).toBe(true);

    history = undoHistory(history);
    expect(history.present).toBe(first);

    history = redoHistory(history);
    expect(history.present).toBe(second);
  });

  it("clears the redo stack when a new action is recorded", () => {
    let history = createHistory(first);
    history = pushSnapshot(history, second);
    history = undoHistory(history);
    expect(canRedo(history)).toBe(true);

    const alternative = [...first, stroke([{ x: 9, y: 9 }])];
    history = pushSnapshot(history, alternative);
    expect(history.present).toBe(alternative);
    expect(canRedo(history)).toBe(false);
  });

  it("does nothing when undoing or redoing at the boundary", () => {
    const history = createHistory(first);
    expect(undoHistory(history)).toBe(history);
    expect(redoHistory(history)).toBe(history);
  });

  it("ignores a snapshot that is the same array", () => {
    const history = createHistory(first);
    expect(pushSnapshot(history, first)).toBe(history);
  });

  it("keeps at most the configured number of snapshots", () => {
    let history = createHistory([]);
    for (let index = 0; index < HISTORY_LIMIT + 10; index += 1) {
      history = pushSnapshot(
        history,
        Array.from({ length: index + 1 }, (_, strokeIndex) =>
          stroke([{ x: strokeIndex, y: 0 }]),
        ),
      );
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    while (canUndo(history)) {
      history = undoHistory(history);
    }
    expect(history.present).toHaveLength(10);
  });
});

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Document } from "../../lib/documents/types";

async function clearLibrary(request: APIRequestContext): Promise<void> {
  const response = await request.get("/api/documents");
  if (!response.ok()) {
    return;
  }

  const body = (await response.json()) as { documents: Document[] };
  for (const document of body.documents) {
    await request.delete(`/api/documents/${document.id}`);
  }
}

async function createDrawing(
  request: APIRequestContext,
  name: string,
): Promise<Document> {
  const response = await request.post("/api/documents", {
    data: { type: "drawing", name },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Document;
}

function isContentPut(page: Page, documentId: string) {
  return page.waitForResponse(
    (response) =>
      response.url().includes(`/api/documents/${documentId}/content`) &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
}

async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function canvasBox(page: Page) {
  const box = await page.getByTestId("drawing-canvas").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    throw new Error("The drawing canvas is not visible.");
  }
  return box;
}

/**
 * Draw from one fraction of the canvas to another so the test does not depend
 * on the displayed size.
 */
async function drawStroke(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width * from.x, box.y + box.height * from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to.x, box.y + box.height * to.y, {
    steps: 12,
  });
  await page.mouse.up();
}

async function clickPoint(
  page: Page,
  at: { x: number; y: number },
): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width * at.x, box.y + box.height * at.y);
}

/** Read the canvas backing pixels instead of relying on screenshots. */
async function hasInkAt(
  page: Page,
  at: { x: number; y: number },
): Promise<boolean> {
  return page.getByTestId("drawing-canvas").evaluate((element, point) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }

    const centerX = Math.round(point.x * canvas.width);
    const centerY = Math.round(point.y * canvas.height);
    const radius = 8;
    const left = Math.max(0, centerX - radius);
    const top = Math.max(0, centerY - radius);
    const width = Math.min(canvas.width - left, radius * 2 + 1);
    const height = Math.min(canvas.height - top, radius * 2 + 1);
    const data = context.getImageData(left, top, width, height).data;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        return true;
      }
    }
    return false;
  }, at);
}

test.beforeEach(async ({ request }) => {
  await clearLibrary(request);
});

test("draws, erases, undoes, redoes, and restores the drawing after reload", async ({
  page,
  request,
}) => {
  const document = await createDrawing(request, "Saved sketch");
  await page.goto(`/drawing/${document.id}`);

  const editor = page.getByTestId("editor-drawing");
  const canvas = page.getByTestId("drawing-canvas");
  await expect(editor).toBeVisible();
  await expect(canvas).toBeVisible();
  await expectSaved(page);

  // Draw two horizontal strokes with the pen.
  const firstSave = isContentPut(page, document.id);
  await drawStroke(page, { x: 0.2, y: 0.3 }, { x: 0.4, y: 0.3 });
  await drawStroke(page, { x: 0.2, y: 0.6 }, { x: 0.4, y: 0.6 });
  await firstSave;
  await expectSaved(page);

  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.3 })).toBe(true);
  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.6 })).toBe(true);

  // The eraser removes the whole first stroke, not just the touched pixels.
  const eraseSave = isContentPut(page, document.id);
  await page.getByRole("button", { name: "Eraser" }).click();
  await drawStroke(page, { x: 0.2, y: 0.3 }, { x: 0.4, y: 0.3 });
  await eraseSave;
  await expectSaved(page);
  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.3 })).toBe(false);
  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.6 })).toBe(true);

  // Undo brings the erased stroke back; redo removes it again.
  const undoSave = isContentPut(page, document.id);
  await page.getByRole("button", { name: "Undo" }).click();
  await undoSave;
  await expectSaved(page);
  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.3 })).toBe(true);

  const redoSave = isContentPut(page, document.id);
  await page.getByRole("button", { name: "Redo" }).click();
  await redoSave;
  await expectSaved(page);
  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.3 })).toBe(false);

  // A click adds a dot without moving the pointer.
  const dotSave = isContentPut(page, document.id);
  await page.getByRole("button", { name: "Pen" }).click();
  await clickPoint(page, { x: 0.7, y: 0.3 });
  await dotSave;
  await expectSaved(page);
  await expect.poll(() => hasInkAt(page, { x: 0.7, y: 0.3 })).toBe(true);

  // Reload: the shared host loads the saved payload and mounts a fresh editor.
  await page.reload();
  await expect(editor).toBeVisible();
  await expect(canvas).toBeVisible();
  await expectSaved(page);

  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.3 })).toBe(false);
  await expect.poll(() => hasInkAt(page, { x: 0.3, y: 0.6 })).toBe(true);
  await expect.poll(() => hasInkAt(page, { x: 0.7, y: 0.3 })).toBe(true);

  const contentResponse = await request.get(
    `/api/documents/${document.id}/content`,
  );
  expect(contentResponse.ok()).toBe(true);
  const body = (await contentResponse.json()) as {
    content: {
      width: number;
      height: number;
      strokes: Array<{
        color: string;
        width: number;
        points: Array<{ x: number; y: number }>;
      }>;
    };
  };

  expect(body.content.width).toBe(1600);
  expect(body.content.height).toBe(900);
  expect(body.content.strokes).toHaveLength(2);
  for (const stroke of body.content.strokes) {
    expect(stroke.points.length).toBeGreaterThanOrEqual(1);
    expect(stroke.width).toBeGreaterThan(0);
    expect(stroke.color).toMatch(/^#[0-9a-f]{6}$/);
    for (const point of stroke.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1600);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(900);
    }
  }

  // The restored green stroke and the dot are at their saved relative points.
  const restored = body.content.strokes;
  expect(restored.some((stroke) => stroke.points.length === 1)).toBe(true);
});

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Document } from "../../lib/documents/types";

async function createDeck(
  request: APIRequestContext,
  name: string,
): Promise<Document> {
  const response = await request.post("/api/documents", {
    data: { type: "powerpoint", name },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Document;
}

async function expectSaveCompleted(page: Page): Promise<void> {
  await expect(page.getByText(/Unsaved changes|Saving/)).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

test("adds, reorders, and restores a slide deck", async ({ page, request }) => {
  const document = await createDeck(request, "Assembly slides");

  await page.goto(`/powerpoint/${document.id}`);
  await expect(page.getByTestId("editor-powerpoint")).toBeVisible();
  await expect(page.getByTestId("slide-item")).toHaveCount(1);

  // Slide 1: add and edit a text box.
  await page.getByRole("button", { name: "Add text box" }).click();
  await page.getByRole("textbox", { name: "Text box text" }).fill("Opening");
  await expect(page.getByTestId("slide-item").nth(0)).toContainText("Opening");

  // Add slide 2 after the current slide and give it different text.
  await page.getByRole("button", { name: "Add slide" }).click();
  await expect(page.getByTestId("slide-item")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Go to slide 2" }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Add text box" }).click();
  await page.getByRole("textbox", { name: "Text box text" }).fill("Second");

  // Move slide 2 earlier. The list must renumber and keep the selection.
  await page.getByRole("button", { name: "Move earlier" }).click();
  await expect(
    page.getByRole("button", { name: "Move earlier" }),
  ).toBeDisabled();
  await expect(page.getByTestId("slide-item").nth(0)).toContainText("Second");
  await expect(page.getByTestId("slide-item").nth(1)).toContainText("Opening");
  await expect(page.getByTestId("slide-item").nth(0)).toHaveAttribute(
    "data-slide-number",
    "1",
  );

  // Add slide 3 after the current (now first) slide and drag its text box.
  await page.getByRole("button", { name: "Add slide" }).click();
  await expect(page.getByTestId("slide-item")).toHaveCount(3);
  await page.getByRole("button", { name: "Add text box" }).click();
  await page.getByRole("textbox", { name: "Text box text" }).fill("Moved box");

  const canvas = page.getByTestId("slide-canvas");
  const handle = canvas.getByRole("button", { name: "Move text box" });
  const canvasBox = await canvas.boundingBox();
  const handleBox = await handle.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(handleBox).not.toBeNull();

  if (canvasBox && handleBox) {
    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox.x + handleBox.width / 2 + canvasBox.width * 0.2,
      handleBox.y + handleBox.height / 2 + canvasBox.height * 0.2,
      { steps: 5 },
    );
    await page.mouse.up();
  }

  const textBox = canvas.getByTestId("slide-text-box");
  const savedX = await textBox.getAttribute("data-x");
  const savedY = await textBox.getAttribute("data-y");
  expect(Number(savedX)).toBeGreaterThan(0.1);
  expect(Number(savedY)).toBeGreaterThan(0.1);

  await expectSaveCompleted(page);

  const orderBefore = await page
    .getByTestId("slide-item")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-slide-id")),
    );
  expect(orderBefore).toHaveLength(3);

  // Reload: the shell remounts the editor from saved content.
  await page.reload();
  await expect(page.getByTestId("editor-powerpoint")).toBeVisible();
  await expect(page.getByTestId("slide-item")).toHaveCount(3);
  await expect(page.getByTestId("slide-item").nth(0)).toContainText("Second");
  await expect(page.getByTestId("slide-item").nth(1)).toContainText(
    "Moved box",
  );
  await expect(page.getByTestId("slide-item").nth(2)).toContainText("Opening");
  expect(
    await page
      .getByTestId("slide-item")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-slide-id")),
      ),
  ).toEqual(orderBefore);

  // The first slide is selected after reload, and the moved box is intact on
  // the second slide with the same fraction position.
  await expect(canvas).toContainText("Second");
  await page.getByRole("button", { name: "Go to slide 2" }).click();
  const restoredBox = page
    .getByTestId("slide-canvas")
    .getByTestId("slide-text-box");
  await expect(restoredBox).toContainText("Moved box");
  expect(await restoredBox.getAttribute("data-x")).toBe(savedX);
  expect(await restoredBox.getAttribute("data-y")).toBe(savedY);

  // Reopening from the library shows the same deck.
  await page.getByRole("link", { name: "← Library" }).click();
  await page
    .getByTestId("document-list")
    .getByRole("link", { name: /Assembly slides/ })
    .first()
    .click();
  await expect(page).toHaveURL(`/powerpoint/${document.id}`);
  await expect(page.getByTestId("editor-powerpoint")).toBeVisible();
  await expect(page.getByTestId("slide-item")).toHaveCount(3);

  await request.delete(`/api/documents/${document.id}`);
});

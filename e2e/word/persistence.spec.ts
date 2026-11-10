import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Document, DocumentType } from "../../lib/documents/types";

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

async function createWord(
  request: APIRequestContext,
  name: string,
): Promise<Document> {
  const response = await request.post("/api/documents", {
    data: { type: "word" as DocumentType, name },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Document;
}

function editorPage(page: Page) {
  return page.getByTestId("word-page");
}

async function openWord(page: Page, id: string): Promise<void> {
  await page.goto(`/word/${id}`);
  await expect(page.getByTestId("editor-word")).toBeVisible();
  await expect(editorPage(page)).toHaveAttribute("contenteditable", "true");
}

test.beforeEach(async ({ request }) => {
  await clearLibrary(request);
});

test("persists typed and formatted Word content across a reload", async ({
  page,
  request,
}) => {
  const document = await createWord(request, "Lesson plan");
  await openWord(page, document.id);

  const surface = editorPage(page);
  await surface.click();
  await page.keyboard.type("Lesson plan");

  await page.getByRole("button", { name: "Heading 1" }).click();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Paragraph" }).click();

  await page.keyboard.type("Bring pencils and paper.");
  await page.keyboard.press("Shift+Home");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.press("End");

  await page.keyboard.press("Enter");
  await page.keyboard.type("First item");
  await page.getByRole("button", { name: "Bulleted list" }).click();
  await page.keyboard.press("Enter");

  const firstSave = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/documents/${document.id}/content`) &&
      response.request().method() === "PUT" &&
      response.ok() &&
      (response.request().postData() ?? "").includes("Second item"),
  );
  await page.keyboard.type("Second item");
  await firstSave;

  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
  await expect(surface.locator("h1")).toHaveText("Lesson plan");
  await expect(surface.locator("ul li")).toHaveCount(2);
  await expect(surface.locator("ul li").nth(1)).toHaveText("Second item");
  await expect(surface.locator("strong")).toContainText(
    "Bring pencils and paper.",
  );

  await page.reload();
  await expect(page.getByTestId("editor-word")).toBeVisible();

  const restored = editorPage(page);
  await expect(restored.locator("h1")).toHaveText("Lesson plan");
  await expect(restored.locator("ul li")).toHaveCount(2);
  await expect(restored.locator("ul li").first()).toHaveText("First item");
  await expect(restored.locator("ul li").nth(1)).toHaveText("Second item");
  await expect(restored.locator("strong")).toContainText(
    "Bring pencils and paper.",
  );
});

test("undoes and redoes text and formatting in the Word page", async ({
  page,
  request,
}) => {
  const document = await createWord(request, "Undo and redo");
  await openWord(page, document.id);

  const surface = editorPage(page);
  await surface.click();
  await page.keyboard.type("D");

  await expect(surface).toContainText("D");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(surface).not.toContainText("D");

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(surface).toContainText("D");

  await page.keyboard.press("Control+A");
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(surface).toContainText("D");
  await expect(surface.locator("strong")).toHaveText("D");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(surface.locator("strong")).toHaveCount(0);
  await expect(surface).toContainText("D");

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(surface.locator("strong")).toHaveText("D");
});

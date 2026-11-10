import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Document, DocumentType } from "../lib/documents/types";

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

async function createDocument(
  request: APIRequestContext,
  input: { type: DocumentType; name?: string },
): Promise<Document> {
  const response = await request.post("/api/documents", { data: input });
  expect(response.status()).toBe(201);
  return (await response.json()) as Document;
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function expectTabsReachable(page: Page): Promise<void> {
  for (const label of ["Library", "Word", "Excel", "PowerPoint", "Drawing"]) {
    await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
}

test.beforeEach(async ({ request }) => {
  await clearLibrary(request);
});

test("creates a document, shows the read-only shell, and restores it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByText("No documents yet")).toBeVisible();

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Type").selectOption("word");
  await page.getByLabel("Name (optional)").fill("Lesson plan");
  await page.getByRole("button", { name: "Create document" }).click();

  await expect(page).toHaveURL(/\/word\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Lesson plan" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Editing tools for Word are not available in this release. This document is read-only.",
  );
  await expect(page.getByTestId("surface-word")).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);

  const documentUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(documentUrl);
  await expect(page.getByRole("heading", { name: "Lesson plan" })).toBeVisible();

  await page.getByRole("link", { name: "← Library" }).click();
  await expect(page).toHaveURL("/");
  const list = page.getByTestId("document-list");
  await expect(list).toContainText("Lesson plan");
  await expect(list).toContainText("Word");

  await list.getByRole("link", { name: /Lesson plan/ }).first().click();
  await expect(page).toHaveURL(documentUrl);
});

test("creates default names and renames from the library and the shell", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New document" }).click();
  await page.getByRole("button", { name: "Create document" }).click();

  await expect(page).toHaveURL(/\/word\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Untitled Word document" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "← Library" }).click();
  await page.getByRole("button", { name: "Rename" }).first().click();
  await page.getByRole("textbox", { name: "Name" }).fill("Lesson plan");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByTestId("document-list")).toContainText("Lesson plan");

  await page.getByRole("link", { name: /Lesson plan/ }).first().click();
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Final lesson plan");
  await page.getByRole("button", { name: "Save name" }).click();

  await expect(
    page.getByRole("heading", { name: "Final lesson plan" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Final lesson plan/);
});

test("switches tabs, restores the active document, and corrects a mismatched address", async ({
  page,
  request,
}) => {
  const word = await createDocument(request, {
    type: "word",
    name: "Tab restore",
  });

  await page.goto("/");
  await page.getByRole("link", { name: /Tab restore/ }).first().click();
  await expect(page).toHaveURL(`/word/${word.id}`);

  await page.getByRole("link", { name: "Excel", exact: true }).click();
  await expect(page).toHaveURL("/excel");
  await expect(
    page.getByRole("heading", { name: "Excel", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("workspace-empty")).toBeVisible();

  await page.getByRole("link", { name: "Word", exact: true }).click();
  await expect(page).toHaveURL(`/word/${word.id}`);
  await expect(page.getByRole("heading", { name: "Tab restore" })).toBeVisible();

  await page.goto(`/excel/${word.id}`);
  await expect(page).toHaveURL(`/word/${word.id}`);
  await expect(page.getByTestId("surface-word")).toBeVisible();
});

test("cancels and confirms deletion, and shows not-found for the deleted address", async ({
  page,
  request,
}) => {
  await createDocument(request, {
    type: "excel",
    name: "Keep me",
  });
  const remove = await createDocument(request, {
    type: "drawing",
    name: "Remove me",
  });

  await page.goto("/");
  const removeRow = page
    .getByTestId("document-list")
    .getByRole("listitem")
    .filter({ hasText: "Remove me" });
  await removeRow.getByRole("button", { name: "Delete" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete “Remove me”?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(removeRow).toBeVisible();

  await removeRow.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete document" }).click();
  await expect(page.getByTestId("document-list")).not.toContainText("Remove me");
  await expect(page.getByTestId("document-list")).toContainText("Keep me");

  await page.goto(`/drawing/${remove.id}`);
  await expect(
    page.getByRole("heading", { name: "Document not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Library" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("document-list")).toContainText("Keep me");
});

test("deletes the open document from its shell", async ({ page, request }) => {
  const document = await createDocument(request, {
    type: "powerpoint",
    name: "Assembly slides",
  });

  await page.goto(`/powerpoint/${document.id}`);
  await expect(
    page.getByRole("heading", { name: "Assembly slides" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete “Assembly slides”?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete document" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("No documents yet")).toBeVisible();
  await expect(page.getByText("Assembly slides")).toHaveCount(0);
});

test("stays usable and free of page overflow at 360px and 1280px", async ({
  page,
  request,
}) => {
  const documents: Document[] = [];
  for (const type of [
    "word",
    "excel",
    "powerpoint",
    "drawing",
  ] as DocumentType[]) {
    documents.push(
      await createDocument(request, {
        type,
        name: `Responsive ${type}`,
      }),
    );
  }

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expectTabsReachable(page);
    await expectNoPageOverflow(page);

    for (const document of documents) {
      await page.goto(`/${document.type}/${document.id}`);
      await expect(page.getByTestId(`surface-${document.type}`)).toBeVisible();
      await expectTabsReachable(page);
      await expectNoPageOverflow(page);
    }
  }
});

test("reports storage health", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(["sqlite", "postgres"]).toContain(body.storage.backend);
});

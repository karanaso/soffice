import { expect, test, type APIRequestContext } from "@playwright/test";
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

async function createDocument(
  request: APIRequestContext,
  input: { type: DocumentType; name: string },
): Promise<Document> {
  const response = await request.post("/api/documents", { data: input });
  expect(response.status()).toBe(201);
  return (await response.json()) as Document;
}

test.beforeEach(async ({ request }) => {
  await clearLibrary(request);
});

test("edits cells and formulas, saves, reloads, and restores raw contents and results", async ({
  page,
  request,
}) => {
  const document = await createDocument(request, {
    type: "excel",
    name: "Markbook",
  });

  await page.goto(`/excel/${document.id}`);
  await expect(page.getByTestId("editor-excel")).toBeVisible();
  await expect(page.getByTestId("excel-grid")).toBeVisible();

  await page.getByTestId("cell-A1").click();
  await page.getByLabel("Cell A1").fill("2");
  await page.getByLabel("Cell A1").press("Enter");

  await page.getByLabel("Cell A2").fill("3");
  await page.getByLabel("Cell A2").press("Enter");

  await page.getByLabel("Cell A3").fill("=SUM(A1:A2)");
  await page.getByLabel("Cell A3").press("Enter");

  await expect(page.getByTestId("cell-A3")).toHaveText("5");

  await page.getByTestId("cell-A1").click();
  await page.getByLabel("Cell A1").fill("10");
  await page.getByLabel("Cell A1").press("Enter");

  await expect(page.getByTestId("cell-A3")).toHaveText("13");

  await expect
    .poll(async () => {
      const response = await request.get(
        `/api/documents/${document.id}/content`,
      );
      if (!response.ok()) {
        return null;
      }
      const body = (await response.json()) as {
        revision: number;
        content: { cells?: Record<string, string> };
      };
      if (body.revision < 1) {
        return null;
      }
      return body.content.cells ?? null;
    })
    .toEqual({ A1: "10", A2: "3", A3: "=SUM(A1:A2)" });

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("editor-excel")).toBeVisible();
  await expect(page.getByTestId("cell-A3")).toHaveText("13");

  await page.getByTestId("cell-A3").click();
  await expect(page.getByTestId("excel-address")).toHaveText("A3");
  await expect(page.getByLabel("Cell A3")).toHaveValue("=SUM(A1:A2)");
  await expect(page.getByLabel("Formula bar")).toHaveValue("=SUM(A1:A2)");

  await page.getByTestId("cell-A1").click();
  await expect(page.getByTestId("excel-address")).toHaveText("A1");
  await expect(page.getByLabel("Cell A1")).toHaveValue("10");
});

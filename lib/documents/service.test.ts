import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";
import { createSqliteClient } from "../db/sqlite";
import type { DatabaseClient } from "../db/client";
import { NotFoundError, ValidationError } from "./errors";
import { createDocumentService, type DocumentService } from "./service";
import { SqliteDocumentRepository } from "./sqlite-repository";

let directory: string;
let database: DatabaseClient;
let service: DocumentService;
let currentTime: Date;

function advance(ms: number): void {
  currentTime = new Date(currentTime.getTime() + ms);
}

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "soffice-service-"));
  database = createSqliteClient(path.join(directory, "test.db"));
  await runMigrations(database);
  currentTime = new Date("2026-01-01T00:00:00.000Z");
  service = createDocumentService(
    new SqliteDocumentRepository(database, { now: () => currentTime }),
    () => randomUUID(),
  );
});

afterEach(async () => {
  await database.close().catch(() => undefined);
  rmSync(directory, { recursive: true, force: true });
});

describe("document service", () => {
  it("creates a named document with the requested type", async () => {
    const document = await service.create({
      type: "excel",
      name: "  Markbook  ",
    });

    expect(document.name).toBe("Markbook");
    expect(document.type).toBe("excel");
    expect(await service.get(document.id)).toEqual(document);
  });

  it("generates default names based on type and makes them unique", async () => {
    const first = await service.create({ type: "word" });
    const second = await service.create({ type: "word", name: "   " });
    const third = await service.create({ type: "powerpoint" });

    expect(first.name).toBe("Untitled Word document");
    expect(second.name).toBe("Untitled Word document 2");
    expect(third.name).toBe("Untitled PowerPoint document");
  });

  it("rejects an unknown document type", async () => {
    await expect(service.create({ type: "pdf" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects a non-text name", async () => {
    await expect(
      service.create({ type: "word", name: 42 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(service.rename("any", 42)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("lists and renames documents", async () => {
    const first = await service.create({ type: "word", name: "Draft" });
    advance(1000);
    const second = await service.create({ type: "drawing", name: "Sketch" });

    expect((await service.list()).map((doc) => doc.id)).toEqual([
      second.id,
      first.id,
    ]);

    const renamed = await service.rename(first.id, "Final");
    expect(renamed.name).toBe("Final");
  });

  it("reports a missing document on rename and delete", async () => {
    await expect(service.rename(randomUUID(), "Missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(service.delete(randomUUID())).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("deletes a document", async () => {
    const created = await service.create({ type: "word", name: "Remove me" });
    await expect(service.delete(created.id)).resolves.toBe(true);
    expect(await service.get(created.id)).toBeNull();
  });
});

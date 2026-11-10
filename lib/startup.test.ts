import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DatabaseClient } from "./db/client";
import type { Migration } from "./db/migrate";
import { createSqliteClient } from "./db/sqlite";
import { prepareStartup } from "./startup";

const resources: Array<{
  database: DatabaseClient;
  directory: string;
}> = [];

function temporaryDatabase(): DatabaseClient {
  const directory = mkdtempSync(path.join(tmpdir(), "soffice-startup-"));
  const database = createSqliteClient(path.join(directory, "test.db"));
  resources.push({ database, directory });
  return database;
}

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.database.close().catch(() => undefined);
    rmSync(resource.directory, { recursive: true, force: true });
  }
});

describe("prepareStartup", () => {
  it("migrates the database before startup completes", async () => {
    const database = temporaryDatabase();
    await prepareStartup({ database });

    const tables = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((table) => table.name)).toContain("documents");
    expect(tables.map((table) => table.name)).toContain("document_contents");

    const applied = await database.query<{ version: string }>(
      "SELECT version FROM schema_migrations",
    );
    expect(applied).toEqual([{ version: "0001" }, { version: "0002" }]);
  });

  it("aborts startup when a migration fails", async () => {
    const database = temporaryDatabase();
    const migrations: Migration[] = [
      { version: "0001", name: "broken", sql: "CREATE TABLE broken (" },
    ];

    await expect(
      prepareStartup({ database, migrations }),
    ).rejects.toThrow();
  });
});

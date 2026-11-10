import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteClient } from "./sqlite";
import { loadMigrations, runMigrations, type Migration } from "./migrate";

const directories: string[] = [];

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "soffice-migrate-"));
  directories.push(directory);
  return path.join(directory, "test.db");
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("runMigrations", () => {
  it("loads the real SQLite migration files", () => {
    const migrations = loadMigrations("sqlite");
    expect(migrations[0]?.version).toBe("0001");
    expect(migrations[0]?.sql).toContain("CREATE TABLE IF NOT EXISTS documents");
  });

  it("applies migrations on first run and is safe to repeat", async () => {
    const database = createSqliteClient(temporaryDatabasePath());
    try {
      const first = await runMigrations(database);
      expect(first.applied).toEqual(["0001"]);

      const second = await runMigrations(database);
      expect(second.applied).toEqual([]);

      const rows = await database.query<{ version: string }>(
        "SELECT version FROM schema_migrations ORDER BY version",
      );
      expect(rows).toEqual([{ version: "0001" }]);
    } finally {
      await database.close();
    }
  });

  it("records a migration once even when it is run twice concurrently", async () => {
    const database = createSqliteClient(temporaryDatabasePath());
    try {
      const results = await Promise.all([
        runMigrations(database),
        runMigrations(database),
      ]);
      const applied = results.flatMap((result) => result.applied);
      expect(applied).toEqual(["0001"]);
    } finally {
      await database.close();
    }
  });

  it("rolls back a failing migration and does not record it", async () => {
    const database = createSqliteClient(temporaryDatabasePath());
    const migrations: Migration[] = [
      {
        version: "0001",
        name: "create_widgets",
        sql: "CREATE TABLE widgets (id TEXT PRIMARY KEY);",
      },
      {
        version: "0002",
        name: "broken",
        sql: "CREATE TABLE broken (",
      },
    ];

    try {
      await expect(
        runMigrations(database, { migrations }),
      ).rejects.toThrow();

      const applied = await database.query<{ version: string }>(
        "SELECT version FROM schema_migrations ORDER BY version",
      );
      expect(applied).toEqual([{ version: "0001" }]);

      const widgets = await database.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'widgets'",
      );
      expect(widgets).toHaveLength(1);
    } finally {
      await database.close();
    }
  });
});

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
    expect(migrations[1]?.version).toBe("0002");
    expect(migrations[1]?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS document_contents",
    );
  });

  it("applies migrations on first run and is safe to repeat", async () => {
    const database = createSqliteClient(temporaryDatabasePath());
    try {
      const first = await runMigrations(database);
      expect(first.applied).toEqual(["0001", "0002"]);

      const second = await runMigrations(database);
      expect(second.applied).toEqual([]);

      const rows = await database.query<{ version: string }>(
        "SELECT version FROM schema_migrations ORDER BY version",
      );
      expect(rows).toEqual([{ version: "0001" }, { version: "0002" }]);
    } finally {
      await database.close();
    }
  });

  it("creates the content table and preserves existing documents", async () => {
    const database = createSqliteClient(temporaryDatabasePath());
    try {
      const migrations = loadMigrations("sqlite");
      await runMigrations(database, { migrations: [migrations[0]!] });
      await database.run(
        "INSERT INTO documents (id, name, name_key, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "doc-1",
          "Existing",
          "existing",
          "word",
          "2026-01-01T00:00:00.000Z",
          "2026-01-01T00:00:00.000Z",
        ],
      );

      await runMigrations(database);

      const documents = await database.query<{ id: string }>(
        "SELECT id FROM documents",
      );
      expect(documents).toEqual([{ id: "doc-1" }]);

      const tables = await database.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'document_contents'",
      );
      expect(tables).toHaveLength(1);
    } finally {
      await database.close();
    }
  });

  it("deletes content when its document is deleted", async () => {
    const database = createSqliteClient(temporaryDatabasePath());
    try {
      await runMigrations(database);
      await database.run(
        "INSERT INTO documents (id, name, name_key, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "doc-1",
          "Existing",
          "existing",
          "word",
          "2026-01-01T00:00:00.000Z",
          "2026-01-01T00:00:00.000Z",
        ],
      );
      await database.run(
        "INSERT INTO document_contents (document_id, revision, content, updated_at) VALUES (?, ?, ?, ?)",
        ["doc-1", 1, '{"blocks":[]}', "2026-01-01T00:00:00.000Z"],
      );

      await database.run("DELETE FROM documents WHERE id = ?", ["doc-1"]);

      const contents = await database.query<{ document_id: string }>(
        "SELECT document_id FROM document_contents",
      );
      expect(contents).toEqual([]);
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
      expect(applied).toEqual(["0001", "0002"]);
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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresClient } from "../db/postgres";
import { createSqliteClient } from "../db/sqlite";
import { runMigrations } from "../db/migrate";
import { NameConflictError, NotFoundError, ValidationError } from "./errors";
import { ContentConflictError } from "../content/errors";
import { PostgresDocumentRepository } from "./postgres-repository";
import type { DocumentRepository } from "./repository";
import { SqliteDocumentRepository } from "./sqlite-repository";
import type { DocumentType } from "./types";

interface Harness {
  readonly repo: DocumentRepository;
  advance(ms: number): void;
  reopen(): Promise<DocumentRepository>;
  dispose(): Promise<void>;
}

interface Clock {
  now(): Date;
  advance(ms: number): void;
}

function createClock(): Clock {
  let current = new Date("2026-01-01T00:00:00.000Z");
  return {
    now: () => current,
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

async function createSqliteHarness(): Promise<Harness> {
  const directory = mkdtempSync(path.join(tmpdir(), "soffice-repository-"));
  const file = path.join(directory, "test.db");
  const clock = createClock();
  let client = createSqliteClient(file);
  await runMigrations(client);
  let repo: DocumentRepository = new SqliteDocumentRepository(client, {
    now: clock.now,
  });

  return {
    get repo() {
      return repo;
    },
    advance: clock.advance,
    async reopen() {
      await client.close();
      client = createSqliteClient(file);
      await runMigrations(client);
      repo = new SqliteDocumentRepository(client, { now: clock.now });
      return repo;
    },
    async dispose() {
      await client.close().catch(() => undefined);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function createPostgresHarness(
  connectionString: string,
): Promise<Harness> {
  const clock = createClock();
  let client = createPostgresClient(connectionString);
  await client.script(
    "DROP TABLE IF EXISTS document_contents CASCADE; DROP TABLE IF EXISTS documents CASCADE; DROP TABLE IF EXISTS schema_migrations CASCADE;",
  );
  await runMigrations(client);
  let repo: DocumentRepository = new PostgresDocumentRepository(client, {
    now: clock.now,
  });

  return {
    get repo() {
      return repo;
    },
    advance: clock.advance,
    async reopen() {
      await client.close();
      client = createPostgresClient(connectionString);
      await runMigrations(client);
      repo = new PostgresDocumentRepository(client, { now: clock.now });
      return repo;
    },
    async dispose() {
      await client.close().catch(() => undefined);
    },
  };
}

function defineRepositoryContract(
  name: string,
  createHarness: () => Promise<Harness>,
): void {
  describe(name, () => {
    let harness: Harness;

    beforeEach(async () => {
      harness = await createHarness();
    });

    afterEach(async () => {
      await harness.dispose();
    });

    it("creates a document with a normalized name and stable metadata", async () => {
      const id = randomUUID();
      const created = await harness.repo.create({
        id,
        name: "  Lesson Plan  ",
        type: "word",
      });

      expect(created).toMatchObject({
        id,
        name: "Lesson Plan",
        type: "word",
      });
      expect(created.createdAt).toBe(created.updatedAt);

      const fetched = await harness.repo.get(id);
      expect(fetched).toEqual(created);
    });

    it("lists documents newest first and reorders after a rename", async () => {
      const first = await harness.repo.create({
        id: randomUUID(),
        name: "First",
        type: "excel",
      });
      harness.advance(1000);
      const second = await harness.repo.create({
        id: randomUUID(),
        name: "Second",
        type: "excel",
      });

      expect((await harness.repo.list()).map((doc) => doc.id)).toEqual([
        second.id,
        first.id,
      ]);

      harness.advance(1000);
      await harness.repo.rename(first.id, "First renamed");

      expect((await harness.repo.list()).map((doc) => doc.id)).toEqual([
        first.id,
        second.id,
      ]);
    });

    it("renames without changing identifier, type, or creation time", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Draft",
        type: "drawing",
      });
      harness.advance(1000);

      const renamed = await harness.repo.rename(created.id, "  Final  ");

      expect(renamed.id).toBe(created.id);
      expect(renamed.type).toBe(created.type);
      expect(renamed.createdAt).toBe(created.createdAt);
      expect(renamed.name).toBe("Final");
      expect(renamed.updatedAt > created.updatedAt).toBe(true);
    });

    it("throws NotFound for missing documents", async () => {
      await expect(
        harness.repo.rename(randomUUID(), "Missing"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("deletes a document once", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Temporary",
        type: "powerpoint",
      });

      expect(await harness.repo.delete(created.id)).toBe(true);
      expect(await harness.repo.get(created.id)).toBeNull();
      expect(await harness.repo.list()).toEqual([]);
      expect(await harness.repo.delete(created.id)).toBe(false);
    });

    it("rejects names that differ only by case", async () => {
      await harness.repo.create({
        id: randomUUID(),
        name: "Lesson",
        type: "word",
      });

      await expect(
        harness.repo.create({
          id: randomUUID(),
          name: " lesson ",
          type: "excel",
        }),
      ).rejects.toBeInstanceOf(NameConflictError);
    });

    it("rejects a rename that collides with another name", async () => {
      const first = await harness.repo.create({
        id: randomUUID(),
        name: "Lesson",
        type: "word",
      });
      const second = await harness.repo.create({
        id: randomUUID(),
        name: "Notes",
        type: "word",
      });

      await expect(
        harness.repo.rename(second.id, "LESSON"),
      ).rejects.toBeInstanceOf(NameConflictError);

      expect((await harness.repo.get(first.id))?.name).toBe("Lesson");
      expect((await harness.repo.get(second.id))?.name).toBe("Notes");
    });

    it("validates names at the storage boundary", async () => {
      await expect(
        harness.repo.create({
          id: randomUUID(),
          name: "   ",
          type: "word",
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Valid",
        type: "word",
      });

      await expect(
        harness.repo.rename(created.id, "x".repeat(121)),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("keeps documents after reconnecting to the same database", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Persistent",
        type: "word",
      });

      const reopened = await harness.reopen();
      expect(await reopened.get(created.id)).toEqual(created);
    });

    it("allows exactly one of two concurrent duplicate creations", async () => {
      const type: DocumentType = "excel";
      const results = await Promise.allSettled([
        harness.repo.create({ id: randomUUID(), name: "Same", type }),
        harness.repo.create({ id: randomUUID(), name: "same", type }),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result) => result.status === "rejected",
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        NameConflictError,
      );
    });

    it("returns null when a document has no saved content", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "No content",
        type: "word",
      });

      expect(await harness.repo.getContent(created.id)).toBeNull();
    });

    it("inserts content at revision 1 and reads it back", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "With content",
        type: "word",
      });

      const saved = await harness.repo.saveContent({
        documentId: created.id,
        revision: 0,
        content: '{"blocks":[]}',
      });

      expect(saved).toMatchObject({
        documentId: created.id,
        revision: 1,
        content: '{"blocks":[]}',
      });
      expect(await harness.repo.getContent(created.id)).toEqual(saved);
    });

    it("increments the revision on each save", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Revisions",
        type: "excel",
      });

      await harness.repo.saveContent({
        documentId: created.id,
        revision: 0,
        content: "{}",
      });
      const second = await harness.repo.saveContent({
        documentId: created.id,
        revision: 1,
        content: '{"cells":{}}',
      });

      expect(second.revision).toBe(2);
      expect(second.content).toBe('{"cells":{}}');
    });

    it("rejects a stale revision without overwriting stored content", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Conflict",
        type: "drawing",
      });
      await harness.repo.saveContent({
        documentId: created.id,
        revision: 0,
        content: '{"strokes":[]}',
      });
      await harness.repo.saveContent({
        documentId: created.id,
        revision: 1,
        content: '{"strokes":[1]}',
      });

      await expect(
        harness.repo.saveContent({
          documentId: created.id,
          revision: 1,
          content: '{"strokes":[2]}',
        }),
      ).rejects.toBeInstanceOf(ContentConflictError);

      expect((await harness.repo.getContent(created.id))?.content).toBe(
        '{"strokes":[1]}',
      );
    });

    it("allows exactly one of two concurrent first saves", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "First save race",
        type: "powerpoint",
      });

      const results = await Promise.allSettled([
        harness.repo.saveContent({
          documentId: created.id,
          revision: 0,
          content: '{"slides":[]}',
        }),
        harness.repo.saveContent({
          documentId: created.id,
          revision: 0,
          content: '{"slides":[1]}',
        }),
      ]);

      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.find(
        (result) => result.status === "rejected",
      ) as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ContentConflictError);
    });

    it("bumps the document's last-modified time when content is saved", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Edited later",
        type: "word",
      });
      harness.advance(1000);

      await harness.repo.saveContent({
        documentId: created.id,
        revision: 0,
        content: '{"blocks":[]}',
      });

      const updated = await harness.repo.get(created.id);
      expect(updated!.updatedAt > created.updatedAt).toBe(true);
    });

    it("deletes stored content with its document", async () => {
      const created = await harness.repo.create({
        id: randomUUID(),
        name: "Delete content",
        type: "drawing",
      });
      await harness.repo.saveContent({
        documentId: created.id,
        revision: 0,
        content: "{}",
      });

      await harness.repo.delete(created.id);

      expect(await harness.repo.getContent(created.id)).toBeNull();
    });

    it("reports NotFound when saving content for a missing document", async () => {
      await expect(
        harness.repo.saveContent({
          documentId: randomUUID(),
          revision: 0,
          content: "{}",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("answers a health ping", async () => {
      await expect(harness.repo.ping()).resolves.toBeUndefined();
    });
  });
}

defineRepositoryContract("SQLite document repository", () =>
  createSqliteHarness(),
);

const postgresUrl = process.env.TEST_POSTGRES_URL;

if (postgresUrl) {
  defineRepositoryContract("PostgreSQL document repository", () =>
    createPostgresHarness(postgresUrl),
  );
} else {
  describe.skip("PostgreSQL document repository", () => {
    it("runs when TEST_POSTGRES_URL is set", () => undefined);
  });
}

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseClient } from "./client";

class SqliteClient implements DatabaseClient {
  readonly dialect = "sqlite" as const;

  private lockTail: Promise<unknown> = Promise.resolve();

  constructor(private readonly database: Database.Database) {}

  async query<T>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    return this.database.prepare(sql).all(...params) as T[];
  }

  async run(sql: string, params: readonly unknown[] = []): Promise<number> {
    const result = this.database.prepare(sql).run(...params);
    return result.changes;
  }

  async script(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(this);
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async withAdvisoryLock<T>(
    _key: number,
    fn: (client: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    // SQLite deployments run a single application process. Serialize startup
    // runs inside that process; the transaction keeps each migration atomic.
    const run = this.lockTail.then(
      () => fn(this),
      () => fn(this),
    );
    this.lockTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async ping(): Promise<void> {
    this.database.prepare("SELECT 1").get();
  }

  async close(): Promise<void> {
    this.database.close();
  }
}

export function createSqliteClient(databasePath: string): DatabaseClient {
  if (databasePath !== ":memory:") {
    const absolutePath = path.resolve(databasePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");

  return new SqliteClient(database);
}

import { Pool, type PoolClient } from "pg";
import type { DatabaseClient } from "./client";

class PostgresClient implements DatabaseClient {
  readonly dialect = "postgres" as const;

  constructor(
    private readonly pool: Pool,
    private readonly dedicated?: PoolClient,
  ) {}

  private get executor(): Pool | PoolClient {
    return this.dedicated ?? this.pool;
  }

  async query<T>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.executor.query(sql, [...params]);
    return result.rows as T[];
  }

  async run(sql: string, params: readonly unknown[] = []): Promise<number> {
    const result = await this.executor.query(sql, [...params]);
    return result.rowCount ?? 0;
  }

  async script(sql: string): Promise<void> {
    await this.executor.query(sql);
  }

  async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    if (this.dedicated) {
      await this.dedicated.query("BEGIN");
      try {
        const result = await fn(this);
        await this.dedicated.query("COMMIT");
        return result;
      } catch (error) {
        await this.dedicated.query("ROLLBACK");
        throw error;
      }
    }

    const client = await this.pool.connect();
    const tx = new PostgresClient(this.pool, client);
    try {
      await client.query("BEGIN");
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async withAdvisoryLock<T>(
    key: number,
    fn: (client: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    const locked = new PostgresClient(this.pool, client);
    try {
      await client.query("SELECT pg_advisory_lock($1)", [key]);
      return await fn(locked);
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [key]);
      } finally {
        client.release();
      }
    }
  }

  async ping(): Promise<void> {
    await this.executor.query("SELECT 1");
  }

  async close(): Promise<void> {
    if (!this.dedicated) {
      await this.pool.end();
    }
  }
}

export function createPostgresClient(connectionString: string): DatabaseClient {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
  });

  pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error.message);
  });

  return new PostgresClient(pool);
}

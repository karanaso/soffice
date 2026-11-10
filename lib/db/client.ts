export type DatabaseDialect = "sqlite" | "postgres";

export interface DatabaseClient {
  readonly dialect: DatabaseDialect;

  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  run(sql: string, params?: readonly unknown[]): Promise<number>;
  script(sql: string): Promise<void>;
  transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
  withAdvisoryLock<T>(
    key: number,
    fn: (client: DatabaseClient) => Promise<T>,
  ): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export const MIGRATION_LOCK_KEY = 0x534f4646;

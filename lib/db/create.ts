import type { AppConfig } from "../config";
import type { DatabaseClient } from "./client";
import { createPostgresClient } from "./postgres";
import { createSqliteClient } from "./sqlite";

export function createDatabase(config: AppConfig): DatabaseClient {
  if (config.databaseBackend === "postgres") {
    if (!config.databaseUrl) {
      throw new Error("PostgreSQL requires DATABASE_URL.");
    }
    return createPostgresClient(config.databaseUrl);
  }

  return createSqliteClient(config.databasePath);
}

import type { DatabaseClient } from "./db/client";
import type { Migration } from "./db/migrate";
import { runMigrations } from "./db/migrate";
import { getDatabase } from "./documents/runtime";

export interface StartupOptions {
  database?: DatabaseClient;
  migrations?: Migration[];
}

/**
 * Prepares the configured database before the server accepts requests.
 * Instrumentation calls this; tests call it with an explicit database.
 */
export async function prepareStartup(
  options: StartupOptions = {},
): Promise<DatabaseClient> {
  const database = options.database ?? (await getDatabase());
  await runMigrations(
    database,
    options.migrations ? { migrations: options.migrations } : {},
  );
  return database;
}

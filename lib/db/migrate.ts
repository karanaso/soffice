import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  MIGRATION_LOCK_KEY,
  type DatabaseClient,
  type DatabaseDialect,
} from "./client";

export interface Migration {
  version: string;
  name: string;
  sql: string;
}

const MIGRATIONS_TABLE_SQL: Record<DatabaseDialect, string> = {
  sqlite: `CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`,
  postgres: `CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL
  );`,
};

const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export function loadMigrations(
  dialect: DatabaseDialect,
  directory = path.join(
    process.cwd(),
    "lib",
    "db",
    "migrations",
    dialect,
  ),
): Migration[] {
  const files = readdirSync(/* turbopackIgnore: true */ directory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const migrations = files.map((file) => {
    const match = MIGRATION_FILE_PATTERN.exec(file);
    if (!match) {
      throw new Error(
        `Invalid migration file name "${file}". Expected NNNN_name.sql.`,
      );
    }

    return {
      version: match[1],
      name: match[2],
      sql: readFileSync(path.join(directory, file), "utf8"),
    };
  });

  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}.`);
    }
    seen.add(migration.version);
  }

  if (migrations.length === 0) {
    throw new Error(`No migrations found in ${directory}.`);
  }

  return migrations;
}

export interface RunMigrationsOptions {
  migrations?: Migration[];
  now?: () => Date;
}

export async function runMigrations(
  database: DatabaseClient,
  options: RunMigrationsOptions = {},
): Promise<{ applied: string[] }> {
  const migrations = (options.migrations ?? loadMigrations(database.dialect)).sort(
    (a, b) => a.version.localeCompare(b.version),
  );
  const now = options.now ?? (() => new Date());

  await database.script(MIGRATIONS_TABLE_SQL[database.dialect]);

  return database.withAdvisoryLock(MIGRATION_LOCK_KEY, async (client) => {
    const rows = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    const appliedVersions = new Set(rows.map((row) => row.version));
    const applied: string[] = [];

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      await client.transaction(async (tx) => {
        await tx.script(migration.sql);
        const placeholders =
          client.dialect === "sqlite" ? "?, ?, ?" : "$1, $2, $3";
        await tx.run(
          `INSERT INTO schema_migrations (version, name, applied_at) VALUES (${placeholders})`,
          [migration.version, migration.name, now().toISOString()],
        );
      });

      applied.push(migration.version);
    }

    return { applied };
  });
}

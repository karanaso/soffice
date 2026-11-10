import { z } from "zod";

export const DATABASE_BACKENDS = ["sqlite", "postgres"] as const;

export type DatabaseBackend = (typeof DATABASE_BACKENDS)[number];

export interface AppConfig {
  databaseBackend: DatabaseBackend;
  databaseUrl: string | null;
  databasePath: string;
  port: number;
}

export class ConfigError extends Error {
  readonly variable: string;

  constructor(variable: string, message: string) {
    super(message);
    this.name = "ConfigError";
    this.variable = variable;
  }
}

/**
 * Removes credentials from any string that may end up in logs or responses.
 * Never include a raw DATABASE_URL in an error message.
 */
export function redactSecrets(value: string): string {
  return value
    .replace(/(postgres(?:ql)?:\/\/)[^@\s/]+@/gi, "$1***:***@")
    .replace(/(password=)[^&\s]+/gi, "$1***");
}

const backendSchema = z.enum(DATABASE_BACKENDS);
const portSchema = z.coerce.number().int().min(1).max(65535);
const pathSchema = z.string().trim().min(1);
const postgresUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
    } catch {
      return false;
    }
  });

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type ConfigEnvironment = Record<string, string | undefined>;

export function loadConfig(env: ConfigEnvironment = process.env): AppConfig {
  const rawBackend = optionalTrimmed(env.DATABASE_BACKEND);
  const databaseUrl = optionalTrimmed(env.DATABASE_URL) ?? null;

  const parsedBackend = backendSchema.safeParse(rawBackend);
  if (rawBackend !== undefined && !parsedBackend.success) {
    throw new ConfigError(
      "DATABASE_BACKEND",
      'DATABASE_BACKEND must be either "sqlite" or "postgres".',
    );
  }

  const explicitBackend = parsedBackend.success
    ? parsedBackend.data
    : undefined;
  if (explicitBackend === "sqlite" && databaseUrl) {
    throw new ConfigError(
      "DATABASE_BACKEND",
      "DATABASE_BACKEND=sqlite cannot be combined with DATABASE_URL. Remove DATABASE_URL or use DATABASE_BACKEND=postgres.",
    );
  }

  const databaseBackend: DatabaseBackend =
    explicitBackend ?? (databaseUrl ? "postgres" : "sqlite");

  if (databaseBackend === "postgres" && !databaseUrl) {
    throw new ConfigError(
      "DATABASE_URL",
      "DATABASE_URL is required when DATABASE_BACKEND=postgres.",
    );
  }

  if (databaseBackend === "postgres" && databaseUrl) {
    const parsedUrl = postgresUrlSchema.safeParse(databaseUrl);
    if (!parsedUrl.success) {
      throw new ConfigError(
        "DATABASE_URL",
        "DATABASE_URL must be a valid postgres:// or postgresql:// connection URL. The supplied value was redacted.",
      );
    }
  }

  const parsedPath = pathSchema.safeParse(
    optionalTrimmed(env.DATABASE_PATH) ?? "./data/soffice.db",
  );
  if (!parsedPath.success) {
    throw new ConfigError(
      "DATABASE_PATH",
      "DATABASE_PATH must be a non-empty file path.",
    );
  }
  const databasePath = parsedPath.data;

  const rawPort = optionalTrimmed(env.PORT) ?? "3000";
  const parsedPort = portSchema.safeParse(rawPort);
  if (!parsedPort.success) {
    throw new ConfigError(
      "PORT",
      "PORT must be an integer between 1 and 65535.",
    );
  }
  const port = parsedPort.data;

  return {
    databaseBackend,
    databaseUrl,
    databasePath,
    port,
  };
}

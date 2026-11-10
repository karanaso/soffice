import { describe, expect, it } from "vitest";
import {
  ConfigError,
  loadConfig,
  redactSecrets,
  type ConfigEnvironment,
} from "./config";

const emptyEnv: ConfigEnvironment = {};

describe("loadConfig", () => {
  it("defaults to SQLite and the default data path", () => {
    const config = loadConfig(emptyEnv);
    expect(config.databaseBackend).toBe("sqlite");
    expect(config.databasePath).toBe("./data/soffice.db");
    expect(config.databaseUrl).toBeNull();
    expect(config.port).toBe(3000);
  });

  it("infers PostgreSQL from DATABASE_URL", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://soffice:secret@db:5432/soffice",
      PORT: "8080",
    });
    expect(config.databaseBackend).toBe("postgres");
    expect(config.databaseUrl).toBe(
      "postgres://soffice:secret@db:5432/soffice",
    );
    expect(config.port).toBe(8080);
  });

  it("accepts an explicit PostgreSQL backend", () => {
    const config = loadConfig({
      DATABASE_BACKEND: "postgres",
      DATABASE_URL: "postgresql://school@db/school",
    });
    expect(config.databaseBackend).toBe("postgres");
  });

  it("uses an explicit SQLite backend and path", () => {
    const config = loadConfig({
      DATABASE_BACKEND: "sqlite",
      DATABASE_PATH: "/var/lib/soffice/school.db",
    });
    expect(config.databaseBackend).toBe("sqlite");
    expect(config.databasePath).toBe("/var/lib/soffice/school.db");
  });

  it("rejects an unsupported backend", () => {
    expect(() => loadConfig({ DATABASE_BACKEND: "mysql" })).toThrowError(
      /DATABASE_BACKEND/,
    );
  });

  it("rejects SQLite combined with a PostgreSQL URL", () => {
    expect(() =>
      loadConfig({
        DATABASE_BACKEND: "sqlite",
        DATABASE_URL: "postgres://soffice:secret@db/soffice",
      }),
    ).toThrowError(/DATABASE_BACKEND=sqlite cannot be combined/);
  });

  it("rejects PostgreSQL without a URL", () => {
    expect(() => loadConfig({ DATABASE_BACKEND: "postgres" })).toThrowError(
      /DATABASE_URL is required/,
    );
  });

  it("rejects an invalid port", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrowError(/PORT/);
    expect(() => loadConfig({ PORT: "70000" })).toThrowError(/PORT/);
  });

  it("never includes credentials in configuration errors", () => {
    const secrets = [
      "mysql://soffice:supersecret@db/soffice",
      "not a url with supersecret",
    ];

    for (const databaseUrl of secrets) {
      try {
        loadConfig({
          DATABASE_BACKEND: "postgres",
          DATABASE_URL: databaseUrl,
        });
        expect.unreachable("configuration should have failed");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as Error).message).not.toContain("supersecret");
      }
    }
  });
});

describe("redactSecrets", () => {
  it("removes passwords from connection strings and key-value pairs", () => {
    expect(
      redactSecrets(
        "failed postgres://soffice:supersecret@db/school?password=another",
      ),
    ).toBe(
      "failed postgres://***:***@db/school?password=***",
    );
  });
});

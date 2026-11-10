import { describe, expect, it } from "vitest";
import type { DatabaseClient } from "../db/client";
import { healthResponse } from "./health";

function fakeDatabase(
  backend: "sqlite" | "postgres",
  reachable: boolean,
): DatabaseClient {
  return {
    dialect: backend,
    query: async () => [],
    run: async () => 0,
    script: async () => undefined,
    transaction: async (fn) => fn({} as DatabaseClient),
    withAdvisoryLock: async (_key, fn) => fn({} as DatabaseClient),
    ping: async () => {
      if (!reachable) {
        throw new Error(
          "connect ECONNREFUSED postgres://soffice:supersecret@db/school",
        );
      }
    },
    close: async () => undefined,
  };
}

describe("health response", () => {
  it("reports healthy SQLite storage", async () => {
    const response = await healthResponse(async () =>
      fakeDatabase("sqlite", true),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      storage: { status: "ok", backend: "sqlite" },
    });
  });

  it("reports healthy PostgreSQL storage", async () => {
    const response = await healthResponse(async () =>
      fakeDatabase("postgres", true),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      storage: { status: "ok", backend: "postgres" },
    });
  });

  it("reports unreachable storage without leaking credentials", async () => {
    const response = await healthResponse(async () =>
      fakeDatabase("postgres", false),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      status: "degraded",
      storage: {
        status: "unavailable",
        backend: "postgres",
        reason: "The database is unreachable.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("supersecret");
  });

  it("reports unknown backend when the database cannot be created", async () => {
    const response = await healthResponse(async () => {
      throw new Error("config failed");
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      storage: { status: "unavailable", backend: "unknown" },
    });
  });
});

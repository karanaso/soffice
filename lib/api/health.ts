import { NextResponse } from "next/server";
import type { DatabaseClient } from "../db/client";

export interface HealthBody {
  status: "ok" | "degraded";
  storage: {
    status: "ok" | "unavailable";
    backend: "sqlite" | "postgres" | "unknown";
    reason?: string;
  };
}

export async function healthResponse(
  getDatabase: () => Promise<DatabaseClient>,
): Promise<NextResponse<HealthBody>> {
  let database: DatabaseClient | null = null;

  try {
    database = await getDatabase();
    await database.ping();
    return NextResponse.json(
      {
        status: "ok",
        storage: { status: "ok", backend: database.dialect },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        storage: {
          status: "unavailable",
          backend: database?.dialect ?? "unknown",
          reason: "The database is unreachable.",
        },
      },
      { status: 503 },
    );
  }
}

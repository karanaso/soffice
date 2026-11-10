import { NextResponse } from "next/server";
import {
  NameConflictError,
  NotFoundError,
  ValidationError,
} from "../documents/errors";

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

function apiError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}

export function mapApiError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return apiError(400, "validation_error", error.message);
  }

  if (error instanceof NameConflictError) {
    return apiError(409, "name_conflict", error.message);
  }

  if (error instanceof NotFoundError) {
    return apiError(404, "not_found", error.message);
  }

  return apiError(
    500,
    "storage_error",
    "The request could not be completed because storage is unavailable. Please retry.",
  );
}

import { NextResponse } from "next/server";
import type { ContentService } from "../content/service";
import { ValidationError } from "../documents/errors";
import { mapApiError } from "./errors";

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}

type Context = { params: Promise<{ id: string }> };

export function createContentHandlers(service: ContentService) {
  return {
    async GET(_request: Request, context: Context): Promise<NextResponse> {
      try {
        const { id } = await context.params;
        return NextResponse.json(await service.get(id));
      } catch (error) {
        return mapApiError(error);
      }
    },

    async PUT(request: Request, context: Context): Promise<NextResponse> {
      try {
        const { id } = await context.params;
        const body = await readJsonObject(request);
        if (!("revision" in body) || !("content" in body)) {
          throw new ValidationError(
            "Provide a revision and content to save the document.",
          );
        }

        const saved = await service.save(id, {
          revision: body.revision,
          content: body.content,
        });
        return NextResponse.json(saved);
      } catch (error) {
        return mapApiError(error);
      }
    },
  };
}

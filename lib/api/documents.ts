import { NextResponse } from "next/server";
import type { DocumentService } from "../documents/service";
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

export function createDocumentsHandlers(service: DocumentService) {
  return {
    async GET(): Promise<NextResponse> {
      try {
        const documents = await service.list();
        return NextResponse.json({ documents });
      } catch (error) {
        return mapApiError(error);
      }
    },

    async POST(request: Request): Promise<NextResponse> {
      try {
        const body = await readJsonObject(request);
        const document = await service.create({
          type: body.type,
          name: body.name,
        });
        return NextResponse.json(document, { status: 201 });
      } catch (error) {
        return mapApiError(error);
      }
    },
  };
}

export function createDocumentHandlers(service: DocumentService) {
  return {
    async GET(
      _request: Request,
      context: { params: Promise<{ id: string }> },
    ): Promise<NextResponse> {
      try {
        const { id } = await context.params;
        const document = await service.get(id);
        if (!document) {
          return NextResponse.json(
            {
              error: { code: "not_found", message: "Document not found." },
            },
            { status: 404 },
          );
        }
        return NextResponse.json(document);
      } catch (error) {
        return mapApiError(error);
      }
    },

    async PATCH(
      request: Request,
      context: { params: Promise<{ id: string }> },
    ): Promise<NextResponse> {
      try {
        const { id } = await context.params;
        const body = await readJsonObject(request);
        if (!("name" in body)) {
          throw new ValidationError("Provide a name to rename the document.");
        }
        const document = await service.rename(id, body.name);
        return NextResponse.json(document);
      } catch (error) {
        return mapApiError(error);
      }
    },

    async DELETE(
      _request: Request,
      context: { params: Promise<{ id: string }> },
    ): Promise<NextResponse> {
      try {
        const { id } = await context.params;
        await service.delete(id);
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return mapApiError(error);
      }
    },
  };
}

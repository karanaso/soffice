import { getDocumentService } from "@/lib/documents/runtime";
import { createDocumentHandlers } from "@/lib/api/documents";
import { mapApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function handlers() {
  return createDocumentHandlers(await getDocumentService());
}

export async function GET(_request: Request, context: Context) {
  try {
    return await (await handlers()).GET(_request, context);
  } catch (error) {
    return mapApiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    return await (await handlers()).PATCH(request, context);
  } catch (error) {
    return mapApiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    return await (await handlers()).DELETE(request, context);
  } catch (error) {
    return mapApiError(error);
  }
}

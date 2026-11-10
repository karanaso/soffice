import { getDocumentService } from "@/lib/documents/runtime";
import { createDocumentsHandlers } from "@/lib/api/documents";
import { mapApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

async function handlers() {
  return createDocumentsHandlers(await getDocumentService());
}

export async function GET() {
  try {
    return await (await handlers()).GET();
  } catch (error) {
    return mapApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    return await (await handlers()).POST(request);
  } catch (error) {
    return mapApiError(error);
  }
}

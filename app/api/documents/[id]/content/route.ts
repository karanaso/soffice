import { getContentService } from "@/lib/content/runtime";
import { createContentHandlers } from "@/lib/api/content";
import { mapApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function handlers() {
  return createContentHandlers(await getContentService());
}

export async function GET(request: Request, context: Context) {
  try {
    return await (await handlers()).GET(request, context);
  } catch (error) {
    return mapApiError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    return await (await handlers()).PUT(request, context);
  } catch (error) {
    return mapApiError(error);
  }
}

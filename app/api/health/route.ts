import { healthResponse } from "@/lib/api/health";
import { getDatabase } from "@/lib/documents/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  return healthResponse(getDatabase);
}

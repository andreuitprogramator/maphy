import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET() {
  const user = await requireUser();
  if (!user) return jsonError(401, "Not authenticated");
  return jsonOk(user);
}


import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { findOrCreateDirectConversation, isMutualFollow } from "@/lib/social/dm";

export async function POST(req: Request) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  if (!username) return jsonError(400, "Missing username");

  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!target) return jsonError(404, "User not found");
  if (target.id === me.id) return jsonError(400, "You cannot message yourself");

  const allowed = await isMutualFollow(me.id, target.id);
  if (!allowed) return jsonError(403, "Mutual follow required for direct messages");

  const conversationId = await findOrCreateDirectConversation(me.id, target.id);
  return jsonOk({ conversationId, username: target.username });
}

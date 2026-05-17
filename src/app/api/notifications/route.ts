import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

export async function GET(req: Request) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 30;

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: me.id },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        isRead: true,
        createdAt: true,
        targetUrl: true,
        relatedProblemId: true,
        relatedConversationId: true,
        actor: { select: { username: true, avatarUrl: true } },
      },
    }),
    prisma.notification.count({ where: { userId: me.id, isRead: false } }),
  ]);

  return jsonOk({ notifications: rows, unreadCount });
}

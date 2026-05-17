import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: me.id },
    select: { conversationId: true, lastReadAt: true },
    orderBy: { conversation: { updatedAt: "desc" } },
  });
  const ids = participants.map((p) => p.conversationId);
  if (ids.length === 0) return jsonOk({ conversations: [], unreadTotal: 0 });

  const [rows, unreadCounts] = await Promise.all([
    prisma.conversation.findMany({
      where: { id: { in: ids } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        updatedAt: true,
        participants: {
          select: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true, senderId: true },
        },
      },
    }),
    Promise.all(
      participants.map(async (p) => {
        const c = await prisma.directMessage.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: me.id },
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        });
        return { conversationId: p.conversationId, unread: c };
      }),
    ),
  ]);

  const unreadMap = new Map(unreadCounts.map((x) => [x.conversationId, x.unread]));
  const conversations = rows.map((r) => {
    const other = r.participants.map((p) => p.user).find((u) => u.id !== me.id);
    const last = r.messages[0] ?? null;
    return {
      id: r.id,
      otherUser: other ?? null,
      lastMessage: last,
      unreadCount: unreadMap.get(r.id) ?? 0,
      updatedAt: r.updatedAt,
    };
  });
  const unreadTotal = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return jsonOk({ conversations, unreadTotal });
}

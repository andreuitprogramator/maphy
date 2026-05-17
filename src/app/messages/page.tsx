import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";
import { Container } from "@/components/layout/container";
import { MessagesClient } from "@/components/messages/messages-client";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const me = await requireUser();
  if (!me) redirect("/login");

  const sp = await searchParams;
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: me.id },
    select: { conversationId: true, lastReadAt: true },
    orderBy: { conversation: { updatedAt: "desc" } },
  });
  const ids = participants.map((p) => p.conversationId);

  const conversations = ids.length
    ? await prisma.conversation.findMany({
        where: { id: { in: ids } },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          updatedAt: true,
          participants: { select: { user: { select: { id: true, username: true, avatarUrl: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, senderId: true } },
        },
      })
    : [];

  const unreadCounts = await Promise.all(
    participants.map(async (p) => {
      const unread = await prisma.directMessage.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: me.id },
          ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
        },
      });
      return { conversationId: p.conversationId, unread };
    }),
  );
  const unreadMap = new Map(unreadCounts.map((x) => [x.conversationId, x.unread]));

  const initialConversations = conversations.map((r) => ({
    id: r.id,
    otherUser: r.participants.map((p) => p.user).find((u) => u.id !== me.id) ?? null,
    lastMessage: r.messages[0] ? { ...r.messages[0], createdAt: r.messages[0].createdAt.toISOString() } : null,
    unreadCount: unreadMap.get(r.id) ?? 0,
    updatedAt: r.updatedAt.toISOString(),
  }));

  const initialConversationId =
    (sp.conversation && initialConversations.find((c) => c.id === sp.conversation)?.id) ??
    initialConversations[0]?.id ??
    null;

  return (
    <Container className="py-8">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Messages</h2>
        <p className="text-sm text-zinc-600">Direct chats are available for mutual followers.</p>
      </div>
      <MessagesClient
        meId={me.id}
        initialConversations={initialConversations}
        initialConversationId={initialConversationId}
      />
    </Container>
  );
}

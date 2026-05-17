import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { isMutualFollow } from "@/lib/social/dm";
import { notifyNewDirectMessage } from "@/lib/notifications/service";

const MAX_MESSAGE_LEN = 2000;

async function getOwnParticipant(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversationId: true, lastReadAt: true },
  });
}

export async function GET(_: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");
  const { conversationId } = await ctx.params;

  const own = await getOwnParticipant(conversationId, me.id);
  if (!own) return jsonError(404, "Conversation not found");

  const [messages, conversation] = await Promise.all([
    prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: { id: true, senderId: true, body: true, createdAt: true },
    }),
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        participants: {
          select: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
      },
    }),
  ]);

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: me.id } },
    data: { lastReadAt: new Date() },
  });

  return jsonOk({
    conversation: {
      id: conversationId,
      participants: conversation?.participants.map((p) => p.user) ?? [],
    },
    messages,
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");
  const { conversationId } = await ctx.params;

  const own = await getOwnParticipant(conversationId, me.id);
  if (!own) return jsonError(404, "Conversation not found");

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const other = participants.find((p) => p.userId !== me.id)?.userId;
  if (!other) return jsonError(400, "Invalid direct conversation");

  const allowed = await isMutualFollow(me.id, other);
  if (!allowed) return jsonError(403, "Mutual follow required for direct messages");

  const rl = rateLimit({ key: `dm:${me.id}:${conversationId}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return jsonError(429, "Too many messages", { retryAfterMs: rl.retryAfterMs });

  const bodyJson = await req.json().catch(() => null);
  const body = String(bodyJson?.body ?? "").trim();
  if (!body) return jsonError(400, "Message cannot be empty");
  if (body.length > MAX_MESSAGE_LEN) return jsonError(400, `Message too long (max ${MAX_MESSAGE_LEN} chars)`);

  const message = await prisma.directMessage.create({
    data: { conversationId, senderId: me.id, body },
    select: { id: true, senderId: true, body: true, createdAt: true },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  await notifyNewDirectMessage({
    recipientUserId: other,
    senderUserId: me.id,
    senderUsername: me.username,
    conversationId,
    messageId: message.id,
  });

  return jsonOk({ message }, { status: 201 });
}

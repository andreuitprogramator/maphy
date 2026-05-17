import { prisma } from "@/lib/db/prisma";

export async function isMutualFollow(userAId: string, userBId: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userAId, followingId: userBId } },
      select: { followerId: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userBId, followingId: userAId } },
      select: { followerId: true },
    }),
  ]);
  return Boolean(ab && ba);
}

export async function findOrCreateDirectConversation(userAId: string, userBId: string): Promise<string> {
  const mine = await prisma.conversationParticipant.findMany({
    where: { userId: userAId },
    select: { conversationId: true },
  });
  if (mine.length > 0) {
    const existing = await prisma.conversationParticipant.findFirst({
      where: {
        userId: userBId,
        conversationId: { in: mine.map((x) => x.conversationId) },
      },
      select: { conversationId: true },
    });
    if (existing) return existing.conversationId;
  }

  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: userAId }, { userId: userBId }],
      },
    },
    select: { id: true },
  });
  return conversation.id;
}

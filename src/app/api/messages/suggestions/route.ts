import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const following = await prisma.follow.findMany({
    where: { followerId: me.id },
    select: { followingId: true },
  });
  if (following.length === 0) return jsonOk({ users: [] });

  const ids = following.map((f) => f.followingId);
  const mutualBack = await prisma.follow.findMany({
    where: { followerId: { in: ids }, followingId: me.id },
    select: { followerId: true },
  });
  const mutualIds = mutualBack.map((x) => x.followerId);
  if (mutualIds.length === 0) return jsonOk({ users: [] });

  const users = await prisma.user.findMany({
    where: { id: { in: mutualIds } },
    orderBy: { username: "asc" },
    take: 20,
    select: { username: true, avatarUrl: true },
  });

  return jsonOk({ users });
}

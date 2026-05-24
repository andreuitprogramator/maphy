import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const type = new URL(req.url).searchParams.get("type");
  if (type !== "followers" && type !== "following") {
    return jsonError(400, "Invalid type");
  }

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) return jsonError(404, "Utilizatorul nu a fost găsit");

  const me = await getSessionUser();

  const rows =
    type === "followers"
      ? await prisma.follow.findMany({
          where: { followingId: user.id },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { follower: { select: { id: true, username: true, avatarUrl: true } } },
        })
      : await prisma.follow.findMany({
          where: { followerId: user.id },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { following: { select: { id: true, username: true, avatarUrl: true } } },
        });

  const users = rows.map((r) => ("follower" in r ? r.follower : r.following));
  const ids = users.map((u) => u.id);

  let followingSet = new Set<string>();
  if (me && ids.length > 0) {
    const follows = await prisma.follow.findMany({
      where: { followerId: me.id, followingId: { in: ids } },
      select: { followingId: true },
    });
    followingSet = new Set(follows.map((f) => f.followingId));
  }

  return jsonOk({
    users: users.map((u) => ({
      username: u.username,
      avatarUrl: u.avatarUrl,
      isYou: me?.id === u.id,
      isFollowing: me ? followingSet.has(u.id) : false,
    })),
  });
}

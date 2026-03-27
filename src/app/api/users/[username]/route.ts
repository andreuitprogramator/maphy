import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET(_: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, bio: true, imageUrl: true, createdAt: true },
  });
  if (!user) return jsonError(404, "User not found");

  const [submissions, agg, followers, following] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        score: true,
        createdAt: true,
        imageUrl: true,
        problem: { select: { id: true, title: true, subject: true, year: true, class: true, phase: true } },
      },
    }),
    prisma.submission.aggregate({
      where: { userId: user.id },
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
  ]);

  return jsonOk({
    user,
    stats: {
      totalSubmissions: agg._count._all,
      avgScore: agg._avg.score ?? 0,
      followers,
      following,
    },
    submissions,
  });
}


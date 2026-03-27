import { prisma } from "@/lib/db/prisma";
import { jsonOk } from "@/lib/api/response";

export async function GET() {
  const [high95, high85, high75, totals] = await Promise.all([
    prisma.submission.groupBy({
      by: ["userId"],
      where: { score: { gte: 95 } },
      _count: { _all: true },
    }),
    prisma.submission.groupBy({
      by: ["userId"],
      where: { score: { gte: 85 } },
      _count: { _all: true },
    }),
    prisma.submission.groupBy({
      by: ["userId"],
      where: { score: { gte: 75 } },
      _count: { _all: true },
    }),
    prisma.submission.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _avg: { score: true },
    }),
  ]);

  const toMap = (rows: { userId: string; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.userId, r._count._all]));

  const m95 = toMap(high95);
  const m85 = toMap(high85);
  const m75 = toMap(high75);

  const userIds = Array.from(new Set(totals.map((t) => t.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, imageUrl: true },
  });
  const uMap = new Map(users.map((u) => [u.id, u]));

  const rows = totals
    .map((t) => ({
      user: uMap.get(t.userId)!,
      totalSubmissions: t._count._all,
      avgScore: t._avg.score ?? 0,
      high95: m95.get(t.userId) ?? 0,
      high85: m85.get(t.userId) ?? 0,
      high75: m75.get(t.userId) ?? 0,
    }))
    .filter((r) => r.user)
    .sort((a, b) => {
      if (b.high95 !== a.high95) return b.high95 - a.high95;
      if (b.high85 !== a.high85) return b.high85 - a.high85;
      if (b.high75 !== a.high75) return b.high75 - a.high75;
      return b.avgScore - a.avgScore;
    })
    .slice(0, 50);

  return jsonOk({ leaderboard: rows });
}


import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
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
    select: { id: true, username: true },
  });
  const uMap = new Map(users.map((u) => [u.id, u]));

  const rows = totals
    .map((t) => ({
      user: uMap.get(t.userId)!,
      total: t._count._all,
      avg: t._avg.score ?? 0,
      c95: m95.get(t.userId) ?? 0,
      c85: m85.get(t.userId) ?? 0,
      c75: m75.get(t.userId) ?? 0,
    }))
    .filter((r) => r.user)
    .sort((a, b) => {
      if (b.c95 !== a.c95) return b.c95 - a.c95;
      if (b.c85 !== a.c85) return b.c85 - a.c85;
      if (b.c75 !== a.c75) return b.c75 - a.c75;
      return b.avg - a.avg;
    })
    .slice(0, 50);

  return (
    <Container className="py-8">
      <div className="grid gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Global leaderboard</h2>
          <p className="text-sm text-zinc-600">
            Ranked by count of high scores (95+, then 85+, then 75+), then average.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Top users</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-600">No submissions yet.</div>
            ) : (
              rows.map((r, idx) => (
                <div
                  key={r.user.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2"
                >
                  <div className="min-w-0 text-sm">
                    <span className="text-zinc-500">{idx + 1}.</span>{" "}
                    <Link className="font-medium text-zinc-900 hover:underline" href={`/u/${r.user.username}`}>
                      @{r.user.username}
                    </Link>
                    <div className="text-xs text-zinc-600">
                      Avg {r.avg.toFixed(1)} · Total {r.total}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">95+ {r.c95}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">85+ {r.c85}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">75+ {r.c75}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}


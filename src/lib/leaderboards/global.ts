import { prisma } from "@/lib/db/prisma";

export const GLOBAL_LEADERBOARD_MODES = ["perfect", "95", "85", "75"] as const;
export type GlobalLeaderboardMode = (typeof GLOBAL_LEADERBOARD_MODES)[number];

export const GLOBAL_LEADERBOARD_MODE_LABELS: Record<GlobalLeaderboardMode, string> = {
  perfect: "Perfect scores (100)",
  "95": "95+ scores",
  "85": "85+ scores",
  "75": "75+ scores",
};

export function parseGlobalLeaderboardMode(raw: string | null | undefined): GlobalLeaderboardMode {
  if (raw === "perfect" || raw === "95" || raw === "85" || raw === "75") return raw;
  return "perfect";
}

export type GlobalLeaderboardRow = {
  username: string;
  avatarUrl: string | null;
  count100: number;
  count95: number;
  count85: number;
  count75: number;
  avgScore: number;
  totalGraded: number;
};

function toCountMap(rows: { userId: string; _count: { _all: number } }[]) {
  return new Map(rows.map((r) => [r.userId, r._count._all]));
}

function sortRows(rows: GlobalLeaderboardRow[], mode: GlobalLeaderboardMode): GlobalLeaderboardRow[] {
  return [...rows].sort((a, b) => {
    switch (mode) {
      case "perfect":
        if (b.count100 !== a.count100) return b.count100 - a.count100;
        if (b.totalGraded !== a.totalGraded) return b.totalGraded - a.totalGraded;
        return b.avgScore - a.avgScore;
      case "95":
        if (b.count95 !== a.count95) return b.count95 - a.count95;
        if (b.count85 !== a.count85) return b.count85 - a.count85;
        return b.avgScore - a.avgScore;
      case "85":
        if (b.count85 !== a.count85) return b.count85 - a.count85;
        if (b.count75 !== a.count75) return b.count75 - a.count75;
        return b.avgScore - a.avgScore;
      case "75":
        if (b.count75 !== a.count75) return b.count75 - a.count75;
        return b.avgScore - a.avgScore;
      default:
        return 0;
    }
  });
}

/** Aggregates graded submissions (aiScore) and ranks by the selected mode. */
export async function getGlobalLeaderboard(mode: GlobalLeaderboardMode): Promise<{
  mode: GlobalLeaderboardMode;
  leaderboard: GlobalLeaderboardRow[];
}> {
  const [exact100, high95, high85, high75, totals] = await Promise.all([
    prisma.submission.groupBy({
      by: ["userId"],
      where: { status: "GRADED", aiScore: 100 },
      _count: { _all: true },
    }),
    prisma.submission.groupBy({
      by: ["userId"],
      where: { status: "GRADED", aiScore: { gte: 95 } },
      _count: { _all: true },
    }),
    prisma.submission.groupBy({
      by: ["userId"],
      where: { status: "GRADED", aiScore: { gte: 85 } },
      _count: { _all: true },
    }),
    prisma.submission.groupBy({
      by: ["userId"],
      where: { status: "GRADED", aiScore: { gte: 75 } },
      _count: { _all: true },
    }),
    prisma.submission.groupBy({
      by: ["userId"],
      where: { status: "GRADED", aiScore: { not: null } },
      _count: { _all: true },
      _avg: { aiScore: true },
    }),
  ]);

  const m100 = toCountMap(exact100);
  const m95 = toCountMap(high95);
  const m85 = toCountMap(high85);
  const m75 = toCountMap(high75);

  const userIds = Array.from(new Set(totals.map((t) => t.userId)));
  if (userIds.length === 0) {
    return { mode, leaderboard: [] };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, avatarUrl: true },
  });
  const uMap = new Map(users.map((u) => [u.id, u]));

  const rows: GlobalLeaderboardRow[] = totals
    .map((t) => {
      const u = uMap.get(t.userId);
      if (!u) return null;
      return {
        username: u.username,
        avatarUrl: u.avatarUrl,
        count100: m100.get(t.userId) ?? 0,
        count95: m95.get(t.userId) ?? 0,
        count85: m85.get(t.userId) ?? 0,
        count75: m75.get(t.userId) ?? 0,
        avgScore: t._avg.aiScore ?? 0,
        totalGraded: t._count._all,
      };
    })
    .filter((r): r is GlobalLeaderboardRow => r !== null);

  const leaderboard = sortRows(rows, mode).slice(0, 50);

  return { mode, leaderboard };
}

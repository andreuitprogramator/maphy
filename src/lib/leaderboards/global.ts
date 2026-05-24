import { prisma } from "@/lib/db/prisma";

export const GLOBAL_LEADERBOARD_MODES = ["p100", "p70", "streak", "sets"] as const;
export type GlobalLeaderboardMode = (typeof GLOBAL_LEADERBOARD_MODES)[number];

export const GLOBAL_LEADERBOARD_MODE_LABELS: Record<GlobalLeaderboardMode, string> = {
  p100: "Probleme de 100",
  p70: "Probleme 70+",
  streak: "Record streak",
  sets: "Subiecte publicate",
};

export const LEADERBOARD_SUBJECTS = ["ALL", "MATH", "PHYSICS", "CHEMISTRY"] as const;
export type LeaderboardSubject = (typeof LEADERBOARD_SUBJECTS)[number];

export const LEADERBOARD_SUBJECT_LABELS: Record<LeaderboardSubject, string> = {
  ALL: "Toate",
  MATH: "Matematică",
  PHYSICS: "Fizică",
  CHEMISTRY: "Chimie",
};

export function parseGlobalLeaderboardMode(raw: string | null | undefined): GlobalLeaderboardMode {
  if ((GLOBAL_LEADERBOARD_MODES as readonly string[]).includes(raw ?? "")) return raw as GlobalLeaderboardMode;
  return "p100";
}

export function parseLeaderboardSubject(raw: string | null | undefined): LeaderboardSubject {
  if ((LEADERBOARD_SUBJECTS as readonly string[]).includes(raw ?? "")) return raw as LeaderboardSubject;
  return "ALL";
}

export type GlobalLeaderboardRow = {
  username: string;
  avatarUrl: string | null;
  p100: number;
  p70: number;
  streak: number;
  sets: number;
};

function computeBestStreak(firstSolveDates: string[]): number {
  const sorted = Array.from(new Set(firstSolveDates)).sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffMs = new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
    if (diffMs === 86_400_000) { run++; if (run > best) best = run; }
    else run = 1;
  }
  return best;
}

export async function getGlobalLeaderboard(
  mode: GlobalLeaderboardMode,
  subject: LeaderboardSubject = "ALL",
): Promise<{ mode: GlobalLeaderboardMode; leaderboard: GlobalLeaderboardRow[] }> {

  // For subject-filtered solve modes, pre-fetch matching problem IDs
  let problemIdFilter: string[] | null = null;
  let contestProblemIdFilter: string[] | null = null;

  if (subject !== "ALL" && mode !== "sets") {
    const [problems, contestProblems] = await Promise.all([
      prisma.problem.findMany({ where: { subject: subject as "MATH" | "PHYSICS" | "CHEMISTRY" }, select: { id: true } }),
      prisma.contestSetProblem.findMany({
        where: { contestSet: { subject: subject as "MATH" | "PHYSICS" | "CHEMISTRY" } },
        select: { id: true },
      }),
    ]);
    problemIdFilter = problems.map((p) => p.id);
    contestProblemIdFilter = contestProblems.map((p) => p.id);
  }

  const submissionOrFilter =
    problemIdFilter !== null || contestProblemIdFilter !== null
      ? [
          ...(problemIdFilter!.length > 0 ? [{ problemId: { in: problemIdFilter! } }] : []),
          ...(contestProblemIdFilter!.length > 0 ? [{ contestSetProblemId: { in: contestProblemIdFilter! } }] : []),
        ]
      : [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }];

  const [solveRows, setsData] = await Promise.all([
    submissionOrFilter.length > 0
      ? prisma.submission.findMany({
          where: { status: "GRADED", aiScore: { gte: 70 }, OR: submissionOrFilter },
          orderBy: { createdAt: "asc" },
          select: { userId: true, problemId: true, contestSetProblemId: true, aiScore: true, createdAt: true },
        })
      : Promise.resolve([]),
    prisma.contestSet.groupBy({
      by: ["createdById"],
      where: {
        status: "PUBLISHED",
        ...(subject !== "ALL" ? { subject: subject as "MATH" | "PHYSICS" | "CHEMISTRY" } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const firstSolveMap = new Map<string, Map<string, string>>();
  const p100Map = new Map<string, Set<string>>();

  for (const r of solveRows) {
    const key = r.problemId ?? `cp:${r.contestSetProblemId}`;
    if (!firstSolveMap.has(r.userId)) firstSolveMap.set(r.userId, new Map());
    const userMap = firstSolveMap.get(r.userId)!;
    if (!userMap.has(key)) userMap.set(key, r.createdAt.toISOString().slice(0, 10));
    if (r.aiScore === 100) {
      if (!p100Map.has(r.userId)) p100Map.set(r.userId, new Set());
      p100Map.get(r.userId)!.add(key);
    }
  }

  const setsCountMap = new Map(setsData.map((s) => [s.createdById, s._count._all]));
  const allUserIds = new Set([...firstSolveMap.keys(), ...Array.from(setsCountMap.keys()).filter((id): id is string => id !== null)]);
  if (allUserIds.size === 0) return { mode, leaderboard: [] };

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(allUserIds) } },
    select: { id: true, username: true, avatarUrl: true },
  });
  const userInfoMap = new Map(users.map((u) => [u.id, u]));

  const rows: GlobalLeaderboardRow[] = [];
  for (const userId of allUserIds) {
    const u = userInfoMap.get(userId);
    if (!u) continue;
    const userSolves = firstSolveMap.get(userId);
    rows.push({
      username: u.username,
      avatarUrl: u.avatarUrl,
      p70: userSolves?.size ?? 0,
      p100: p100Map.get(userId)?.size ?? 0,
      streak: computeBestStreak(userSolves ? Array.from(userSolves.values()) : []),
      sets: setsCountMap.get(userId) ?? 0,
    });
  }

  const primaryKey: Record<GlobalLeaderboardMode, keyof GlobalLeaderboardRow> = {
    p100: "p100", p70: "p70", streak: "streak", sets: "sets",
  };
  const pk = primaryKey[mode];

  rows.sort((a, b) => {
    const diff = (b[pk] as number) - (a[pk] as number);
    if (diff !== 0) return diff;
    return b.p70 - a.p70;
  });

  return { mode, leaderboard: rows.filter((r) => (r[pk] as number) > 0).slice(0, 50) };
}

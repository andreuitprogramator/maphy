import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { SubmissionStatus } from "@prisma/client";

const VALID_SORTS = ["newest","oldest","score_desc","score_asc","title_az","title_za","difficulty_desc","difficulty_asc"] as const;
type Sort = typeof VALID_SORTS[number];

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  if (!username) return jsonError(400, "Numele de utilizator lipsește");

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
  if (!user) return jsonError(404, "Utilizatorul nu a fost găsit");

  const url = new URL(req.url);
  const sp = url.searchParams;

  const rawSort = sp.get("sort") ?? "newest";
  const sort: Sort = (VALID_SORTS as readonly string[]).includes(rawSort) ? (rawSort as Sort) : "newest";
  const subject = sp.get("subject") ?? "any";
  const status = sp.get("status") ?? "any";
  const scoreBucket = sp.get("score") ?? "any";
  const best = sp.get("best") === "1";
  const rawLimit = Number(sp.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;

  // Build score filter
  const scoreWhere =
    scoreBucket === "100" ? { aiScore: 100 } :
    scoreBucket === "95"  ? { aiScore: { gte: 95 } } :
    scoreBucket === "85"  ? { aiScore: { gte: 85 } } :
    scoreBucket === "75"  ? { aiScore: { gte: 75 } } :
    scoreBucket === "below75" ? { aiScore: { lt: 75 } } :
    {};
  const validStatuses = Object.values(SubmissionStatus) as string[];
  const statusWhere = status !== "any" && validStatuses.includes(status)
    ? { status: status as SubmissionStatus }
    : {};

  // Fetch all matching rows (capped); subject/sort handled in memory since they span two nullable relations
  const raw = await prisma.submission.findMany({
    where: {
      userId: user.id,
      OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }],
      ...statusWhere,
      ...scoreWhere,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      status: true,
      aiScore: true,
      aiFeedback: true,
      aiBreakdown: true,
      imageQualityReason: true,
      reviewedAt: true,
      createdAt: true,
      imageUrl: true,
      problem: { select: { id: true, title: true, subject: true, difficulty: true, year: true, class: true, phase: true } },
      contestSetProblem: {
        select: {
          id: true,
          title: true,
          orderNumber: true,
          contestSetId: true,
          contestSet: { select: { id: true, title: true, subject: true } },
        },
      },
    },
  });

  type Mapped = {
    id: string;
    status: string;
    aiScore: number | null;
    aiFeedback: string | null;
    aiBreakdown: unknown;
    imageQualityReason: string | null;
    reviewedAt: string | null;
    createdAt: string;
    imageUrl: string;
    attempts?: number;
    problem: { id: string; title: string; subject?: string; difficulty?: number; year?: number; classLevel?: number; phase?: string; contestSetId?: string; contestSetOrderNumber?: number };
    _key: string;
  };

  let mapped: Mapped[] = raw.map((r) => ({
    id: r.id,
    status: r.status,
    aiScore: r.aiScore,
    aiFeedback: r.aiFeedback,
    aiBreakdown: r.aiBreakdown,
    imageQualityReason: r.imageQualityReason,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    imageUrl: r.imageUrl,
    problem: r.problem
      ? { id: r.problem.id, title: r.problem.title, subject: r.problem.subject, difficulty: r.problem.difficulty, year: r.problem.year, classLevel: r.problem.class, phase: r.problem.phase }
      : {
          id: r.contestSetProblem!.id,
          title: `Problema ${r.contestSetProblem!.orderNumber} — ${r.contestSetProblem!.contestSet.title}`,
          subject: r.contestSetProblem!.contestSet.subject,
          contestSetId: r.contestSetProblem!.contestSet.id,
          contestSetOrderNumber: r.contestSetProblem!.orderNumber,
        },
    _key: r.problem ? `p:${r.problem.id}` : `cp:${r.contestSetProblem!.id}`,
  }));

  // Subject filter (in memory because it spans two relations)
  if (subject !== "any") {
    mapped = mapped.filter((r) => r.problem.subject === subject);
  }

  // Best per problem
  if (best) {
    const attemptsMap = new Map<string, number>();
    const bestMap = new Map<string, Mapped>();
    for (const r of mapped) {
      attemptsMap.set(r._key, (attemptsMap.get(r._key) ?? 0) + 1);
      const existing = bestMap.get(r._key);
      if (!existing || (r.aiScore ?? -1) > (existing.aiScore ?? -1)) bestMap.set(r._key, r);
    }
    mapped = Array.from(bestMap.values()).map((r) => ({ ...r, attempts: attemptsMap.get(r._key) }));
  }

  // Sort
  mapped.sort((a, b) => {
    switch (sort) {
      case "oldest":        return a.createdAt.localeCompare(b.createdAt);
      case "score_desc":    return (b.aiScore ?? -1) - (a.aiScore ?? -1);
      case "score_asc":     return (a.aiScore ?? 10000) - (b.aiScore ?? 10000);
      case "title_az":      return a.problem.title.localeCompare(b.problem.title);
      case "title_za":      return b.problem.title.localeCompare(a.problem.title);
      case "difficulty_desc": return (b.problem.difficulty ?? 0) - (a.problem.difficulty ?? 0);
      case "difficulty_asc":  return (a.problem.difficulty ?? 0) - (b.problem.difficulty ?? 0);
      default:              return b.createdAt.localeCompare(a.createdAt);
    }
  });

  // Stats (unfiltered, all user submissions)
  const [allAgg, gradedAgg, perfectCount] = await Promise.all([
    prisma.submission.aggregate({
      where: { userId: user.id, OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }] },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.submission.aggregate({
      where: { userId: user.id, OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }], status: "GRADED", aiScore: { not: null } },
      _avg: { aiScore: true },
      _count: { _all: true },
    }),
    prisma.submission.count({
      where: { userId: user.id, OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }], status: "GRADED", aiScore: 100 },
    }),
  ]);

  const resultRows = mapped.slice(0, limit).map(({ _key, ...r }) => r);

  return jsonOk({
    rows: resultRows,
    stats: {
      totalSubmissions: allAgg._count._all,
      distinctProblems: new Set(mapped.map((r) => r._key)).size,
      perfectCount,
      avgScore: gradedAgg._count._all > 0 ? gradedAgg._avg.aiScore : null,
      latestActivityAt: allAgg._max.createdAt ? allAgg._max.createdAt.toISOString() : null,
    },
  });
}


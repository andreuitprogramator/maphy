import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";

const SortSchema = z.enum([
  "newest",
  "oldest",
  "score_desc",
  "score_asc",
  "title_az",
  "title_za",
  "difficulty_desc",
  "difficulty_asc",
]);

const ScoreBucketSchema = z.enum(["any", "100", "95", "85", "75", "below75"]);

const StatusSchema = z.enum(["any", "GRADED", "PENDING", "BLURRY_REJECTED", "FAILED"]);
const SubjectSchema = z.enum(["any", "MATH", "PHYSICS"]);

function orderByFor(sort: z.infer<typeof SortSchema>) {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" as const }];
    case "oldest":
      return [{ createdAt: "asc" as const }];
    case "score_desc":
      return [{ aiScore: "desc" as const }, { createdAt: "desc" as const }];
    case "score_asc":
      return [{ aiScore: "asc" as const }, { createdAt: "desc" as const }];
    case "title_az":
      return [{ problem: { title: "asc" as const } }, { createdAt: "desc" as const }];
    case "title_za":
      return [{ problem: { title: "desc" as const } }, { createdAt: "desc" as const }];
    case "difficulty_desc":
      return [{ problem: { difficulty: "desc" as const } }, { createdAt: "desc" as const }];
    case "difficulty_asc":
      return [{ problem: { difficulty: "asc" as const } }, { createdAt: "desc" as const }];
    default:
      return [{ createdAt: "desc" as const }];
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  if (!username) return jsonError(400, "Missing username");

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
  if (!user) return jsonError(404, "User not found");

  const url = new URL(req.url);
  const sort = SortSchema.safeParse(url.searchParams.get("sort") ?? "newest").success
    ? (url.searchParams.get("sort") as z.infer<typeof SortSchema>)
    : "newest";
  const subject = SubjectSchema.safeParse(url.searchParams.get("subject") ?? "any").success
    ? (url.searchParams.get("subject") as z.infer<typeof SubjectSchema>)
    : "any";
  const status = StatusSchema.safeParse(url.searchParams.get("status") ?? "any").success
    ? (url.searchParams.get("status") as z.infer<typeof StatusSchema>)
    : "any";
  const scoreBucket = ScoreBucketSchema.safeParse(url.searchParams.get("score") ?? "any").success
    ? (url.searchParams.get("score") as z.infer<typeof ScoreBucketSchema>)
    : "any";
  const best = (url.searchParams.get("best") ?? "0") === "1";

  const rawLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;

  const phase = url.searchParams.get("phase")?.trim() || null;
  const year = url.searchParams.get("year")?.trim() || null;
  const klass = url.searchParams.get("class")?.trim() || null;

  const where: Record<string, unknown> = { userId: user.id, problemId: { not: null } };
  if (status !== "any") where.status = status;
  if (subject !== "any") where.problem = { ...(where.problem as object), subject };
  if (phase) where.problem = { ...(where.problem as object), phase };
  if (year && /^\d{4}$/.test(year)) where.problem = { ...(where.problem as object), year: Number(year) };
  if (klass && /^\d{1,2}$/.test(klass)) where.problem = { ...(where.problem as object), class: Number(klass) };

  if (scoreBucket !== "any") {
    // score buckets apply to graded submissions only
    where.status = "GRADED";
    if (scoreBucket === "100") where.aiScore = 100;
    if (scoreBucket === "95") where.aiScore = { gte: 95 };
    if (scoreBucket === "85") where.aiScore = { gte: 85 };
    if (scoreBucket === "75") where.aiScore = { gte: 75 };
    if (scoreBucket === "below75") where.aiScore = { lt: 75 };
  }

  const select = {
    id: true,
    status: true,
    aiScore: true,
    aiFeedback: true,
    aiBreakdown: true,
    imageQualityReason: true,
    reviewedAt: true,
    createdAt: true,
    imageUrl: true,
    problemId: true,
    problem: { select: { id: true, title: true, subject: true, difficulty: true, year: true, class: true, phase: true } },
  } as const;

  let rows: any[] = [];
  let attemptsByProblem: Record<string, number> = {};

  if (best) {
    // best per problem: pick best row per problemId; then sort in-memory by chosen sort.
    const raw = await prisma.submission.findMany({
      where,
      distinct: ["problemId"],
      orderBy: [{ aiScore: "desc" }, { createdAt: "desc" }],
      take: 300,
      select,
    });

    // attempts count per problem for display
    const counts = await prisma.submission.groupBy({
      by: ["problemId"],
      where,
      _count: { _all: true },
    });
    attemptsByProblem = Object.fromEntries(counts.map((c) => [String(c.problemId), c._count._all]));

    // sort resulting best rows
    const sortKey = sort;
    rows = raw.sort((a, b) => {
      if (sortKey === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortKey === "score_desc") return (b.aiScore ?? -1) - (a.aiScore ?? -1);
      if (sortKey === "score_asc") return (a.aiScore ?? 10_000) - (b.aiScore ?? 10_000);
      if (sortKey === "title_az") return String(a.problem?.title ?? "").localeCompare(String(b.problem?.title ?? ""));
      if (sortKey === "title_za") return String(b.problem?.title ?? "").localeCompare(String(a.problem?.title ?? ""));
      if (sortKey === "difficulty_desc") return (b.problem?.difficulty ?? 0) - (a.problem?.difficulty ?? 0);
      if (sortKey === "difficulty_asc") return (a.problem?.difficulty ?? 0) - (b.problem?.difficulty ?? 0);
      // newest default
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    rows = rows.slice(0, limit);
  } else {
    rows = await prisma.submission.findMany({
      where,
      orderBy: orderByFor(sort),
      take: limit,
      select,
    });
  }

  const stats = await prisma.submission.aggregate({
    where: { userId: user.id, problemId: { not: null } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const distinctProblems = await prisma.submission.findMany({
    where: { userId: user.id, problemId: { not: null } },
    distinct: ["problemId"],
    select: { problemId: true },
  });
  const gradedAgg = await prisma.submission.aggregate({
    where: { userId: user.id, problemId: { not: null }, status: "GRADED", aiScore: { not: null } },
    _avg: { aiScore: true },
    _count: { _all: true },
  });
  const perfectCount = await prisma.submission.count({
    where: { userId: user.id, problemId: { not: null }, status: "GRADED", aiScore: 100 },
  });

  return jsonOk({
    rows: rows.map((r) => ({
      id: r.id,
      status: r.status,
      aiScore: r.aiScore,
      aiFeedback: r.aiFeedback,
      aiBreakdown: r.aiBreakdown,
      imageQualityReason: r.imageQualityReason,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      imageUrl: r.imageUrl,
      attempts: best ? attemptsByProblem[String(r.problemId)] ?? 1 : null,
      problem: {
        id: r.problem?.id ?? "",
        title: r.problem?.title ?? "Unknown",
        subject: r.problem?.subject ?? "MATH",
        difficulty: r.problem?.difficulty ?? 0,
        year: r.problem?.year ?? 0,
        classLevel: r.problem?.class ?? 0,
        phase: r.problem?.phase ?? "LOCAL",
      },
    })),
    stats: {
      totalSubmissions: stats._count._all,
      distinctProblems: distinctProblems.length,
      perfectCount,
      avgScore: gradedAgg._count._all > 0 ? gradedAgg._avg.aiScore : null,
      latestActivityAt: stats._max.createdAt ? stats._max.createdAt.toISOString() : null,
    },
  });
}


import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sortEnrichedProblems, type ProblemSortId } from "@/lib/problems/sort";

export type ProblemCardStats = {
  submissionCount: number;
  ratingAvg: number | null;
  ratingCount: number;
  perfectSolveUserCount: number;
  mySubmissionCount: number;
  myRatingStars: number | null;
  hasPerfect100: boolean;
  canRate: boolean;
};

export type EnrichedProblem = {
  id: string;
  title: string;
  subject: "MATH" | "PHYSICS";
  difficulty: number;
  year: number;
  class: number;
  phase: "LOCAL" | "COUNTY" | "NATIONAL";
  stats: ProblemCardStats;
  myMaxScore: number | null;
};

export async function fetchEnrichedProblems(
  where: Prisma.ProblemWhereInput,
  sort: ProblemSortId,
  viewerUserId: string | null,
): Promise<EnrichedProblem[]> {
  const problems = await prisma.problem.findMany({
    where,
    select: {
      id: true,
      title: true,
      subject: true,
      difficulty: true,
      year: true,
      class: true,
      phase: true,
    },
  });

  if (problems.length === 0) return [];

  const ids = problems.map((p) => p.id);

  const [subCounts, ratingGroups, perfectSubs, mySubCounts, myGradedSubs, myRatings] = await Promise.all([
    prisma.submission.groupBy({
      by: ["problemId"],
      where: { problemId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.problemRating.groupBy({
      by: ["problemId"],
      where: { problemId: { in: ids } },
      _avg: { ratingValue: true },
      _count: { _all: true },
    }),
    prisma.submission.findMany({
      where: { problemId: { in: ids }, status: "GRADED", aiScore: 100 },
      select: { problemId: true, userId: true },
    }),
    viewerUserId
      ? prisma.submission.groupBy({
          by: ["problemId"],
          where: { userId: viewerUserId, problemId: { in: ids } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { problemId: string; _count: { _all: number } }[]),
    viewerUserId
      ? prisma.submission.findMany({
          where: {
            userId: viewerUserId,
            problemId: { in: ids },
            status: "GRADED",
            aiScore: { not: null },
          },
          select: { problemId: true, aiScore: true },
        })
      : Promise.resolve([] as { problemId: string; aiScore: number }[]),
    viewerUserId
      ? prisma.problemRating.findMany({
          where: { userId: viewerUserId, problemId: { in: ids } },
          select: { problemId: true, ratingValue: true },
        })
      : Promise.resolve([] as { problemId: string; ratingValue: number }[]),
  ]);

  const subMap = new Map(subCounts.map((s) => [s.problemId, s._count._all]));
  const ratingMap = new Map(
    ratingGroups.map((r) => [
      r.problemId,
      {
        avg: r._avg.ratingValue != null ? r._avg.ratingValue : null,
        count: r._count._all,
      },
    ]),
  );

  const perfectDistinct = new Map<string, Set<string>>();
  for (const row of perfectSubs) {
    if (!row.problemId) continue;
    if (!perfectDistinct.has(row.problemId)) perfectDistinct.set(row.problemId, new Set());
    perfectDistinct.get(row.problemId)!.add(row.userId);
  }

  const mySubMap = new Map(mySubCounts.map((s) => [s.problemId, s._count._all]));
  const myMaxMap = new Map<string, number>();
  for (const row of myGradedSubs) {
    if (!row.problemId) continue;
    if (row.aiScore == null) continue;
    const cur = myMaxMap.get(row.problemId) ?? 0;
    myMaxMap.set(row.problemId, Math.max(cur, row.aiScore));
  }
  const myRatingMap = new Map(myRatings.map((r) => [r.problemId, r.ratingValue]));

  const enriched: EnrichedProblem[] = problems.map((p) => {
    const submissionCount = subMap.get(p.id) ?? 0;
    const rg = ratingMap.get(p.id);
    const ratingAvg = rg?.avg ?? null;
    const ratingCount = rg?.count ?? 0;
    const perfectSolveUserCount = perfectDistinct.get(p.id)?.size ?? 0;
    const mySubmissionCount = mySubMap.get(p.id) ?? 0;
    const myMax = myMaxMap.has(p.id) ? myMaxMap.get(p.id)! : null;
    const hasPerfect100 = myMax === 100;
    const myRv = myRatingMap.get(p.id);
    const myRatingStars = myRv != null ? myRv : null;

    return {
      ...p,
      stats: {
        submissionCount,
        ratingAvg,
        ratingCount,
        perfectSolveUserCount,
        mySubmissionCount,
        myRatingStars,
        hasPerfect100,
        canRate: hasPerfect100,
      },
      myMaxScore: myMax,
    };
  });

  return sortEnrichedProblems(enriched, sort);
}

export type ProblemDetailStats = {
  submissionCount: number;
  mySubmissionCount: number;
  ratingAvg: number | null;
  ratingCount: number;
  perfect100UserCount: number;
  hasPerfect100: boolean;
  canRate: boolean;
  myRatingStars: number | null;
};

export async function fetchProblemDetailStats(
  problemId: string,
  viewerUserId: string | null,
): Promise<ProblemDetailStats> {
  const [
    submissionCount,
    mySubmissionCount,
    ratingAgg,
    perfectRows,
    myPerfect,
    myRating,
  ] = await Promise.all([
    prisma.submission.count({ where: { problemId } }),
    viewerUserId
      ? prisma.submission.count({ where: { problemId, userId: viewerUserId } })
      : Promise.resolve(0),
    prisma.problemRating.aggregate({
      where: { problemId },
      _avg: { ratingValue: true },
      _count: { _all: true },
    }),
    prisma.submission.findMany({
      where: { problemId, status: "GRADED", aiScore: 100 },
      select: { userId: true },
    }),
    viewerUserId
      ? prisma.submission.findFirst({
          where: { problemId, userId: viewerUserId, status: "GRADED", aiScore: 100 },
          select: { id: true },
        })
      : Promise.resolve(null),
    viewerUserId
      ? prisma.problemRating.findUnique({
          where: { userId_problemId: { userId: viewerUserId, problemId } },
          select: { ratingValue: true },
        })
      : Promise.resolve(null),
  ]);

  const perfectSet = new Set(perfectRows.map((r) => r.userId));

  return {
    submissionCount,
    mySubmissionCount,
    ratingAvg:
      ratingAgg._avg.ratingValue != null ? (ratingAgg._avg.ratingValue as number) : null,
    ratingCount: ratingAgg._count._all,
    perfect100UserCount: perfectSet.size,
    hasPerfect100: Boolean(myPerfect),
    canRate: Boolean(myPerfect),
    myRatingStars: myRating ? myRating.ratingValue : null,
  };
}

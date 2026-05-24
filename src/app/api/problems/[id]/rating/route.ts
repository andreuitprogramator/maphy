import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  parseClientStarRating,
  starsToStorage,
  userHasPerfect100OnProblem,
} from "@/lib/problems/rating";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Neautentificat");

  const { id: problemId } = await ctx.params;
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, status: true },
  });
  if (!problem) return jsonError(404, "Problema nu a fost găsită");
  if (problem.status !== ProblemStatus.PUBLISHED) return jsonError(403, "Only published problems can be rated.");

  const body = await req.json().catch(() => null);
  let stars: number;
  try {
    stars = parseClientStarRating(body?.rating);
  } catch {
    return jsonError(400, "Invalid rating (integer 1–10)");
  }

  const allowed = await userHasPerfect100OnProblem(me.id, problemId);
  if (!allowed) return jsonError(403, "You need a perfect score (100) on this problem to rate it.");

  let storage: number;
  try {
    storage = starsToStorage(stars);
  } catch {
    return jsonError(400, "Invalid rating");
  }

  await prisma.problemRating.upsert({
    where: { userId_problemId: { userId: me.id, problemId } },
    create: { userId: me.id, problemId, ratingValue: storage },
    update: { ratingValue: storage },
  });

  const agg = await prisma.problemRating.aggregate({
    where: { problemId },
    _avg: { ratingValue: true },
    _count: { _all: true },
  });

  return jsonOk({
    rating: stars,
    ratingAvg: agg._avg.ratingValue != null ? (agg._avg.ratingValue as number) : null,
    ratingCount: agg._count._all,
  });
}

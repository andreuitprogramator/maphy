import { prisma } from "@/lib/db/prisma";
import { RATING_MAX, RATING_MIN } from "@/lib/problems/rating-constants";

export { RATING_MAX, RATING_MIN } from "@/lib/problems/rating-constants";

const ALLOWED = new Set(Array.from({ length: RATING_MAX }, (_, i) => i + RATING_MIN));

export function normalizeRatingStorage(n: number): number {
  const v = Math.round(n);
  if (v < RATING_MIN || v > RATING_MAX) {
    throw new Error("Rating out of range");
  }
  return v;
}

/** Parse client/API input: integer 1–10. */
export function parseClientStarRating(input: unknown): number {
  const n = typeof input === "string" ? Number(input) : Number(input);
  if (!Number.isFinite(n)) throw new Error("Invalid rating");
  const v = Math.round(n);
  if (!ALLOWED.has(v)) throw new Error("Invalid rating");
  return v;
}

export function starsToStorage(stars: number): number {
  return normalizeRatingStorage(stars);
}

export async function userHasPerfect100OnProblem(userId: string, problemId: string): Promise<boolean> {
  const row = await prisma.submission.findFirst({
    where: { userId, problemId, status: "GRADED", aiScore: 100 },
    select: { id: true },
  });
  return Boolean(row);
}

import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; order: string }> },
) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Neautentificat");

  const { id: contestSetId, order } = await ctx.params;
  const orderNumber = Number(order);
  if (!Number.isFinite(orderNumber)) return jsonError(400, "Invalid");

  const problem = await prisma.contestSetProblem.findFirst({
    where: { contestSetId, orderNumber },
    select: { id: true },
  });
  if (!problem) return jsonError(404, "Problema nu a fost găsită");

  const qualified = await prisma.submission.findFirst({
    where: { userId: me.id, contestSetProblemId: problem.id, status: "GRADED", aiScore: { gte: 70 } },
    select: { id: true },
  });
  if (!qualified) return jsonError(403, "Trebuie să obții cel puțin 70 de puncte pentru a evalua această problemă.");

  const body = await req.json().catch(() => null);
  const rating = typeof body?.rating === "number" ? Math.round(body.rating) : NaN;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return jsonError(400, "Rating invalid (1–5 stele)");
  }

  await prisma.contestSetProblemRating.upsert({
    where: { userId_contestSetProblemId: { userId: me.id, contestSetProblemId: problem.id } },
    create: { userId: me.id, contestSetProblemId: problem.id, ratingValue: rating },
    update: { ratingValue: rating },
  });

  return jsonOk({ rating });
}

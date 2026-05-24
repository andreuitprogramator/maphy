import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await requireUser();
  if (!user) return jsonError(401, "Neautentificat");

  const submission = await prisma.submission.findUnique({
    where: { id },
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
      userId: true,
    },
  });

  if (!submission) return jsonError(404, "Rezolvarea nu a fost găsită");
  if (submission.userId !== user.id) return jsonError(403, "Acces interzis");

  return jsonOk({ submission });
}

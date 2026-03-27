import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET(_: Request, ctx: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await ctx.params;
  if (!problemId) return jsonError(400, "Missing problemId");

  const leaderboard = await prisma.submission.findMany({
    where: { problemId },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: 20,
    select: {
      id: true,
      score: true,
      createdAt: true,
      user: { select: { id: true, username: true, imageUrl: true } },
    },
  });

  return jsonOk({ leaderboard });
}


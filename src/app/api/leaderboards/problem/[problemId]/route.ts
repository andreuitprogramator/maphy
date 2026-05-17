import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET(_: Request, ctx: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await ctx.params;
  if (!problemId) return jsonError(400, "Missing problemId");

  const leaderboard = await prisma.submission.findMany({
    where: { problemId, status: "GRADED" },
    orderBy: [{ aiScore: "desc" }, { createdAt: "asc" }],
    take: 20,
    select: {
      id: true,
      aiScore: true,
      createdAt: true,
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  return jsonOk({ leaderboard });
}


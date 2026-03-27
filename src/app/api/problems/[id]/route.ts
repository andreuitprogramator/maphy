import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const problem = await prisma.problem.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      statement: true,
      subject: true,
      difficulty: true,
      year: true,
      class: true,
      phase: true,
    },
  });
  if (!problem) return jsonError(404, "Problem not found");
  return jsonOk(problem);
}


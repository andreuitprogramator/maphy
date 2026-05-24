import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

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
      status: true,
      createdById: true,
    },
  });
  if (!problem) return jsonError(404, "Problema nu a fost găsită");
  if (problem.status === ProblemStatus.DRAFT) {
    const me = await requireUser();
    if (!me || me.id !== problem.createdById) return jsonError(404, "Problema nu a fost găsită");
  }
  return jsonOk(problem);
}


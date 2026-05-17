import { z } from "zod";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { jsonOk } from "@/lib/api/response";

const QuerySchema = z.object({
  subject: z.enum(["MATH", "PHYSICS"]).optional(),
  year: z.coerce.number().int().optional(),
  class: z.coerce.number().int().optional(),
  phase: z.enum(["LOCAL", "COUNTY", "NATIONAL"]).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  const where = parsed.success
    ? {
        status: ProblemStatus.PUBLISHED,
        subject: parsed.data.subject,
        year: parsed.data.year,
        class: parsed.data.class,
        phase: parsed.data.phase,
      }
    : { status: ProblemStatus.PUBLISHED };

  const problems = await prisma.problem.findMany({
    where,
    orderBy: [{ year: "desc" }, { difficulty: "asc" }, { title: "asc" }],
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

  return jsonOk({ problems });
}


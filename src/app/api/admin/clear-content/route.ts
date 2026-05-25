import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";

export async function DELETE(req: Request) {
  const teacher = await requireTeacher();
  if (!teacher || teacher.username !== "pip") return jsonError(403, "Forbidden");

  const [problems, contestSets] = await Promise.all([
    prisma.problem.deleteMany({}),
    prisma.contestSet.deleteMany({}),
  ]);

  return jsonOk({ deleted: { problems: problems.count, contestSets: contestSets.count } });
}

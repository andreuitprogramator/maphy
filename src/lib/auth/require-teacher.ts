import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

export type SessionTeacher = {
  id: string;
  username: string;
  roleLabel: UserRole;
};

/** Returns the signed-in user only if they are a teacher; otherwise null. */
export async function requireTeacher(): Promise<SessionTeacher | null> {
  const user = await requireUser();
  if (!user || user.roleLabel !== UserRole.TEACHER) return null;
  return { id: user.id, username: user.username, roleLabel: user.roleLabel };
}

/** Load teacher row with ownership check for a problem authored by this user. */
export async function assertTeacherOwnsProblem(teacherId: string, problemId: string) {
  const row = await prisma.problem.findFirst({
    where: { id: problemId, createdById: teacherId },
    select: { id: true },
  });
  return row != null;
}

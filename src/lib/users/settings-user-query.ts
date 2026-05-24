import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

/** Fields always available (works with DB before `aiTeacherStyle` migration). */
export const settingsUserBaseSelect = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  school: true,
  bio: true,
  avatarUrl: true,
  roleLabel: true,
  usernameChangedAt: true,
  createdAt: true,
} as const;

export const settingsUserFullSelect = {
  ...settingsUserBaseSelect,
  aiTeacherStyle: true,
} as const;

export async function findUserForSettingsPage(userId: string) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: settingsUserFullSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientValidationError) {
      return prisma.user.findUnique({
        where: { id: userId },
        select: settingsUserBaseSelect,
      });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      return prisma.user.findUnique({
        where: { id: userId },
        select: settingsUserBaseSelect,
      });
    }
    throw e;
  }
}

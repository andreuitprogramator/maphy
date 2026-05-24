import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonOk } from "@/lib/api/response";
import { profilePatchSchema } from "@/lib/users/validation";
import { Prisma, UserRole } from "@prisma/client";
import {
  findUserForSettingsPage,
  settingsUserBaseSelect,
  settingsUserFullSelect,
} from "@/lib/users/settings-user-query";

export async function GET() {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const user = await findUserForSettingsPage(me.id);
  if (!user) return jsonError(404, "Utilizatorul nu a fost găsit");
  return jsonOk({ user });
}

export async function PATCH(req: Request) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const body = await req.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Date invalide", { issues: parsed.error.flatten().fieldErrors as object });
  }

  const data = parsed.data;

  const current = await prisma.user.findUnique({
    where: { id: me.id },
    select: { roleLabel: true },
  });
  if (current?.roleLabel === UserRole.TEACHER && data.roleLabel === UserRole.STUDENT) {
    return jsonError(400, "Teachers cannot switch back to Student.");
  }

  if (data.username !== me.username) {
    const currentUser = await prisma.user.findUnique({
      where: { id: me.id },
      select: { usernameChangedAt: true },
    });
    if (currentUser?.usernameChangedAt) {
      const nextAllowed = new Date(currentUser.usernameChangedAt);
      nextAllowed.setDate(nextAllowed.getDate() + 7);
      if (new Date() < nextAllowed) {
        return jsonError(429, `Poți schimba username-ul din nou pe ${nextAllowed.toLocaleDateString("ro-RO")}.`);
      }
    }
    const taken = await prisma.user.findFirst({
      where: { username: data.username, NOT: { id: me.id } },
      select: { id: true },
    });
    if (taken) return jsonError(409, "Numele de utilizator este deja ocupat", { issues: { username: ["Numele de utilizator este deja ocupat"] } });
  }

  const usernameChanged = data.username !== me.username;

  const baseData = {
    username: data.username,
    firstName: data.firstName,
    lastName: data.lastName,
    bio: data.bio ?? "",
    country: data.country ?? "",
    city: data.city ?? "",
    school: data.school ?? "",
    preferredLanguage: data.preferredLanguage ?? "",
    roleLabel: data.roleLabel,
  };

  try {
    const user = await prisma.user.update({
      where: { id: me.id },
      data: { ...baseData, aiTeacherStyle: data.aiTeacherStyle },
      select: settingsUserFullSelect,
    });

    if (usernameChanged) {
      try {
        await prisma.user.update({ where: { id: me.id }, data: { usernameChangedAt: new Date() } });
      } catch { /* ignore if field doesn't exist yet */ }
    }

    return jsonOk({ user });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(409, "Numele de utilizator este deja ocupat", { issues: { username: ["Numele de utilizator este deja ocupat"] } });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      const user = await prisma.user.update({
        where: { id: me.id },
        data: baseData,
        select: settingsUserBaseSelect,
      });

      if (usernameChanged) {
        try {
          await prisma.user.update({ where: { id: me.id }, data: { usernameChangedAt: new Date() } });
        } catch { /* ignore if field doesn't exist yet */ }
      }

      return jsonOk({ user });
    }
    throw e;
  }
}

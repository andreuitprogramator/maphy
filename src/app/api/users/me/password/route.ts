import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { jsonError, jsonOk } from "@/lib/api/response";

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
  confirmPassword: z.string().min(1),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Parolele noi nu coincid",
  path: ["confirmPassword"],
});

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return jsonError(401, "Neautentificat");

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Date invalide";
    return jsonError(400, msg);
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!user) return jsonError(404, "Utilizatorul nu a fost găsit");

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return jsonError(400, "Parola actuală este incorectă");

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: newHash } });

  return jsonOk({ success: true });
}

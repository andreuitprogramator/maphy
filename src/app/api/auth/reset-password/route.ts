import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { jsonOk, jsonError } from "@/lib/api/response";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { z } from "zod";

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const rl = rateLimit({ key: `reset-pw:${getIp(req)}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Prea multe încercări. Încearcă din nou mai târziu.");

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Date invalide");

  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });

  if (!record) return jsonError(400, "Link invalid sau deja folosit");
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } });
    return jsonError(400, "Linkul a expirat. Solicită un link nou.");
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.delete({ where: { token } }),
  ]);

  return jsonOk({ message: "Parola a fost schimbată cu succes." });
}

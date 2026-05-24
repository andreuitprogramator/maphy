import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { sendPasswordResetEmail } from "@/lib/email/mailer";
import { jsonOk, jsonError } from "@/lib/api/response";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { z } from "zod";

const Schema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: Request) {
  const rl = rateLimit({ key: `forgot-pw:${getIp(req)}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Prea multe încercări. Încearcă din nou mai târziu.");

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Date invalide");

  const { username } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, email: true },
  });

  if (!user) return jsonError(404, "Nu există niciun cont cu acest username.");
  if (user.email !== email) return jsonError(400, "Emailul nu corespunde acestui cont.");

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  await sendPasswordResetEmail(email, `${baseUrl}/reset-password?token=${token}`);

  return jsonOk({ message: "Vei primi un link de resetare pe email." });
}

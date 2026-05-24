import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/response";
import { rateLimit, getIp } from "@/lib/rate-limit";

const LoginSchema = z.object({
  identifier: z.string().min(1).max(254),
  password: z.string().min(1).max(72),
});

export async function POST(req: Request) {
  const rl = rateLimit({ key: `login:${getIp(req)}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Prea multe încercări. Încearcă din nou mai târziu.");

  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Date invalide", { issues: parsed.error.issues });

  const { identifier, password } = parsed.data;
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] },
  });
  if (!user) return jsonError(401, "Email, username sau parolă invalidă");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return jsonError(401, "Email sau parolă invalidă");

  if (!user.emailVerified) {
    return jsonError(403, "Emailul nu a fost verificat. Verifică-ți căsuța de email și apasă linkul de confirmare.");
  }

  const token = signAccessToken({ sub: user.id, username: user.username });
  const res = NextResponse.json(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    { status: 200 },
  );
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signAccessToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/response";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return jsonError(400, "Token lipsă");

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, username: true, emailVerified: true } } },
  });

  if (!record) return jsonError(400, "Link invalid sau deja folosit");
  if (record.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } });
    return jsonError(400, "Linkul a expirat. Te rugăm să te înregistrezi din nou.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.emailVerificationToken.delete({ where: { token } }),
  ]);

  const sessionToken = signAccessToken({ sub: record.user.id, username: record.user.username });
  const res = NextResponse.redirect(new URL("/?verified=1", req.url));
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

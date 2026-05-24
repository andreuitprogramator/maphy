import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { signAccessToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  if (!email) return NextResponse.json({ verified: false });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, username: true, emailVerified: true },
  });

  if (!user?.emailVerified) return NextResponse.json({ verified: false });

  const sessionToken = signAccessToken({ sub: user.id, username: user.username });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ verified: true });
}

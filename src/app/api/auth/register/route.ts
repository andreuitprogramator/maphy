import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

const RegisterSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid input", { issues: parsed.error.issues });

  const { username, email, password } = parsed.data;

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { username, email: email.toLowerCase(), passwordHash },
      select: { id: true, username: true, email: true, bio: true, imageUrl: true },
    });

    const token = signAccessToken({ sub: user.id, username: user.username });
    const res = NextResponse.json(user, { status: 201 });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(409, "Username or email already in use");
    }
    return jsonError(500, "Registration failed");
  }
}


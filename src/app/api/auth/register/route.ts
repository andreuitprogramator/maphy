import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/response";
import { Prisma } from "@prisma/client";
import { registerBodySchema } from "@/lib/users/validation";

const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  country: true,
  city: true,
  bio: true,
  avatarUrl: true,
  roleLabel: true,
  preferredLanguage: true,
} as const;

export async function POST(req: Request) {
  if (!process.env.JWT_SECRET?.trim()) {
    console.error("[register] JWT_SECRET is not set");
    return jsonError(
      500,
      "Server misconfiguration: add JWT_SECRET to your .env file (see .env.example).",
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid input", { issues: parsed.error.flatten().fieldErrors as object });
  }

  const { username, email, password, firstName, lastName, country, city } = parsed.data;
  const emailNorm = email.toLowerCase();

  const conflict = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: emailNorm }] },
    select: { username: true, email: true },
  });
  if (conflict) {
    if (conflict.username === username) {
      return jsonError(409, "Username already taken");
    }
    return jsonError(409, "Email already in use");
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email: emailNorm,
        passwordHash,
        firstName,
        lastName,
        country: country?.trim() ?? "",
        city: city?.trim() ?? "",
      },
      select: publicUserSelect,
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
    console.error("[register]", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(409, "Username or email already in use");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError(
        500,
        `Database error (${e.code}). If you changed the schema recently, run: npx prisma migrate dev`,
      );
    }
    if (e instanceof Error && e.message.includes("JWT_SECRET")) {
      return jsonError(500, "Server misconfiguration: set JWT_SECRET in your .env file.");
    }
    return jsonError(
      500,
      process.env.NODE_ENV === "development" && e instanceof Error
        ? `Registration failed: ${e.message}`
        : "Registration failed",
    );
  }
}

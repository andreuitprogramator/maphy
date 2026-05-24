import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { jsonError, jsonOk } from "@/lib/api/response";
import { Prisma } from "@prisma/client";
import { registerBodySchema } from "@/lib/users/validation";
import { sendVerificationEmail } from "@/lib/email/mailer";
import { rateLimit, getIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rl = rateLimit({ key: `register:${getIp(req)}`, limit: 5, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Prea multe conturi create. Încearcă din nou mai târziu.");

  if (!process.env.JWT_SECRET?.trim()) {
    console.error("[register] JWT_SECRET is not set");
    return jsonError(500, "Server misconfiguration: add JWT_SECRET to your .env file.");
  }

  const body = await req.json().catch(() => null);
  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Date invalide", { issues: parsed.error.flatten().fieldErrors as object });
  }

  const { username, email, password, firstName, lastName, country, city } = parsed.data;
  const emailNorm = email.toLowerCase();

  // Remove any unverified account with the same email/username so user can re-register
  await prisma.user.deleteMany({
    where: { emailVerified: false, OR: [{ username }, { email: emailNorm }] },
  });

  const conflict = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: emailNorm }] },
    select: { username: true, email: true },
  });
  if (conflict) {
    if (conflict.username === username) return jsonError(409, "Numele de utilizator este deja ocupat");
    return jsonError(409, "Emailul este deja folosit");
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
        emailVerified: false,
      },
      select: { id: true, username: true, email: true },
    });

    // Create verification token (24h expiry)
    const token = randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(emailNorm, verifyUrl);

    return NextResponse.json({ ok: true, message: "Verifică-ți emailul pentru a finaliza înregistrarea." }, { status: 201 });
  } catch (e: unknown) {
    console.error("[register]", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(409, "Numele de utilizator sau emailul este deja folosit");
    }
    return jsonError(500, process.env.NODE_ENV === "development" && e instanceof Error ? `Registration failed: ${e.message}` : "Înregistrarea a eșuat");
  }
}

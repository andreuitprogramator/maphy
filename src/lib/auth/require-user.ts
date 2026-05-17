import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifyAccessToken } from "@/lib/auth/jwt";

const requireUserSelect = {
  id: true,
  username: true,
  email: true,
  bio: true,
  avatarUrl: true,
  firstName: true,
  lastName: true,
  roleLabel: true,
} as const;

export async function requireUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: requireUserSelect,
    });
    return user;
  } catch {
    return null;
  }
}

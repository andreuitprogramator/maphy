import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { verifyAccessToken } from "@/lib/auth/jwt";

export const SESSION_COOKIE_NAME = "maphy_session";

const sessionUserSelect = {
  id: true,
  username: true,
  email: true,
  bio: true,
  avatarUrl: true,
  firstName: true,
  lastName: true,
  roleLabel: true,
} as const;

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: sessionUserSelect,
    });
    return user;
  } catch {
    return null;
  }
}

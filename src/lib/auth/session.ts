import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { verifyAccessToken } from "@/lib/auth/jwt";

export const SESSION_COOKIE_NAME = "maphy_session";

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true, bio: true, imageUrl: true },
    });
    return user;
  } catch {
    return null;
  }
}


import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";

const MAX_Q = 64;
const LIMIT = 20;

function truncateText(text: string, max = 140) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") ?? "").trim();
  if (raw.length === 0) return jsonOk({ users: [] });
  if (raw.length > MAX_Q) return jsonError(400, "Interogare prea lungă");

  const me = await getSessionUser();

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: raw, mode: "insensitive" } },
        { email: { contains: raw, mode: "insensitive" } },
        { firstName: { contains: raw, mode: "insensitive" } },
        { lastName: { contains: raw, mode: "insensitive" } },
      ],
    },
    take: LIMIT,
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      bio: true,
      school: true,
      avatarUrl: true,
      _count: { select: { followers: true } },
    },
  });

  let followingSet = new Set<string>();
  if (me && users.length > 0) {
    const ids = users.map((u) => u.id).filter((id) => id !== me.id);
    if (ids.length > 0) {
      const rows = await prisma.follow.findMany({
        where: { followerId: me.id, followingId: { in: ids } },
        select: { followingId: true },
      });
      followingSet = new Set(rows.map((r) => r.followingId));
    }
  }

  const payload = users.map((u) => {
    const nameParts = [u.firstName.trim(), u.lastName.trim()].filter(Boolean);
    const displayName = nameParts.length > 0 ? nameParts.join(" ") : null;
    const schoolLine = u.school.trim();
    const bioLine = u.bio.trim();
    const subtitle =
      schoolLine.length > 0
        ? truncateText(schoolLine, 120)
        : bioLine.length > 0
          ? truncateText(bioLine, 120)
          : "";
    return {
      username: u.username,
      avatarUrl: u.avatarUrl,
      displayName,
      subtitle,
      followerCount: u._count.followers,
      isYou: me?.id === u.id,
      isFollowing: me && me.id !== u.id ? followingSet.has(u.id) : false,
    };
  });

  return jsonOk({ users: payload });
}

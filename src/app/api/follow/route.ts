import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonOk } from "@/lib/api/response";
import { notifyUserFollowed } from "@/lib/notifications/service";

const BodySchema = z.object({ username: z.string().min(1) });

export async function POST(req: Request) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid input");

  const target = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });
  if (!target) return jsonError(404, "User not found");
  if (target.id === me.id) return jsonError(400, "You cannot follow yourself");

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
    select: { followerId: true },
  });
  if (!existing) {
    await prisma.follow.create({
      data: { followerId: me.id, followingId: target.id },
    });
    await notifyUserFollowed({
      followerId: me.id,
      followerUsername: me.username,
      targetUserId: target.id,
    });
  }

  const followersCount = await prisma.follow.count({ where: { followingId: target.id } });
  return jsonOk({ ok: true, followersCount });
}

export async function DELETE(req: Request) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const url = new URL(req.url);
  const username = url.searchParams.get("username");
  if (!username) return jsonError(400, "Missing username");

  const target = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!target) return jsonError(404, "User not found");

  await prisma.follow
    .delete({ where: { followerId_followingId: { followerId: me.id, followingId: target.id } } })
    .catch(() => null);

  const followersCount = await prisma.follow.count({ where: { followingId: target.id } });
  return jsonOk({ ok: true, followersCount });
}


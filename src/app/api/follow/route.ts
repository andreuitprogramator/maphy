import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonOk } from "@/lib/api/response";

const BodySchema = z.object({ username: z.string().min(1) });

export async function POST(req: Request) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid input");

  const target = await prisma.user.findUnique({ where: { username: parsed.data.username }, select: { id: true } });
  if (!target) return jsonError(404, "User not found");
  if (target.id === me.id) return jsonError(400, "You cannot follow yourself");

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
    create: { followerId: me.id, followingId: target.id },
    update: {},
  });

  return jsonOk({ ok: true });
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

  return jsonOk({ ok: true });
}


import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { jsonError } from "@/lib/api/response";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");

  if (!userId || !secret) return jsonError(400, "Parametri lipsă");
  if (secret !== (process.env.ADMIN_SECRET ?? "dev-secret")) return jsonError(403, "Secret invalid");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
  if (!user) return jsonError(404, "Utilizatorul nu există");

  await prisma.user.update({ where: { id: userId }, data: { roleLabel: UserRole.TEACHER } });

  return NextResponse.redirect(new URL(`/u/${user.username}`, req.url));
}

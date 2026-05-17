import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");
  const { id } = await ctx.params;

  const row = await prisma.notification.findFirst({
    where: { id, userId: me.id },
    select: { id: true, isRead: true },
  });
  if (!row) return jsonError(404, "Notification not found");
  if (!row.isRead) {
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  return jsonOk({ ok: true });
}

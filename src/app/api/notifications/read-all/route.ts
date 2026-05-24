import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

export async function POST() {
  const me = await requireUser();
  if (!me) return jsonError(401, "Neautentificat");

  const result = await prisma.notification.updateMany({
    where: { userId: me.id, isRead: false },
    data: { isRead: true },
  });

  return jsonOk({ ok: true, updated: result.count });
}

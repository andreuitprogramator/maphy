import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const unreadCount = await prisma.notification.count({
    where: { userId: me.id, isRead: false },
  });
  return jsonOk({ unreadCount });
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NotificationsList } from "@/components/notifications/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: me.id },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        isRead: true,
        createdAt: true,
        targetUrl: true,
        actor: { select: { username: true, avatarUrl: true } },
      },
    }),
    prisma.notification.count({ where: { userId: me.id, isRead: false } }),
  ]);

  const initialRows = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <Container className="py-8">
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold tracking-tight text-zinc-900">Notifications</div>
          <div className="text-sm text-zinc-600">Recent activity around your account.</div>
        </CardHeader>
        <CardContent>
          <NotificationsList initialRows={initialRows} initialUnreadCount={unreadCount} />
        </CardContent>
      </Card>
    </Container>
  );
}

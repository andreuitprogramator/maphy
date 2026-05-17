import Image from "next/image";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { NavbarNotificationsLink } from "@/components/notifications/navbar-notifications-link";

export async function Navbar() {
  const user = await getSessionUser();
  let unreadCount = 0;
  let unreadNotifications = 0;
  if (user) {
    const [mine, unreadNotificationsCount] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where: { userId: user.id },
        select: { conversationId: true, lastReadAt: true },
      }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);
    const unread = await Promise.all(
      mine.map((p) =>
        prisma.directMessage.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: user.id },
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        }),
      ),
    );
    unreadCount = unread.reduce((s, n) => s + n, 0);
    unreadNotifications = unreadNotificationsCount;
  }

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[color:var(--accent)] text-white font-semibold">
            M
          </span>
          <span className="font-semibold tracking-tight text-zinc-900">Maphy</span>
        </Link>

        <nav className="hidden shrink-0 items-center gap-1 sm:flex">
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/math">
            Math
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/physics">
            Physics
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/problems">
            Browse
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/leaderboard">
            Leaderboard
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/users">
            Users
          </Link>
          {user ? (
            <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/messages">
              Messages{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </Link>
          ) : null}
          {user ? <NavbarNotificationsLink initialUnreadCount={unreadNotifications} /> : null}
          {user?.roleLabel === UserRole.TEACHER ? (
            <Link className="px-3 py-2 text-sm font-medium text-[color:var(--accent)] hover:text-[color:var(--accent-2)]" href="/teacher">
              Teacher
            </Link>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            className="px-2 py-2 text-sm text-zinc-700 hover:text-zinc-900 sm:hidden"
            href="/math"
          >
            Math
          </Link>
          <Link className="px-2 py-2 text-sm text-zinc-700 hover:text-zinc-900 sm:hidden" href="/physics">
            Physics
          </Link>
          {user ? (
            <Link className="px-2 py-2 text-sm text-zinc-700 hover:text-zinc-900 sm:hidden" href="/notifications">
              Alerts{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
            </Link>
          ) : null}
          {user ? (
            <>
              <Link
                className="hidden items-center gap-2 rounded-full py-1 sm:inline-flex"
                href={`/u/${user.username}`}
              >
                {user.avatarUrl ? (
                  <span className="relative h-8 w-8 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50">
                    <Image src={user.avatarUrl} alt="" fill className="object-cover" sizes="32px" />
                  </span>
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="px-1 text-sm text-zinc-700 hover:text-zinc-900">@{user.username}</span>
              </Link>
              <Link
                className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 md:inline"
                href="/settings"
              >
                Settings
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button variant="secondary" size="sm" type="submit">
                  Logout
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Create account</Button>
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}

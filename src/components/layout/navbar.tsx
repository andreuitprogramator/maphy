import Image from "next/image";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { usernameColorClass } from "@/lib/ui/username-color";
import { prisma } from "@/lib/db/prisma";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { NavbarNotificationsLink } from "@/components/notifications/navbar-notifications-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export async function Navbar() {
  const user = await getSessionUser();
  let unreadNotifications = 0;
  if (user) {
    unreadNotifications = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
  }

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center">
          <span className="text-xl font-bold tracking-tight text-zinc-900">maphy</span>
        </Link>

        <nav className="hidden shrink-0 items-center gap-1 sm:flex">
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/math">
            Matematică
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/physics">
            Fizică
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/chemistry">
            Chimie
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/leaderboard">
            Clasament
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/users">
            Utilizatori
          </Link>
          {user ? <NavbarNotificationsLink initialUnreadCount={unreadNotifications} /> : null}
          {user?.roleLabel === UserRole.TEACHER ? (
            <Link className="px-3 py-2 text-sm font-medium text-[color:var(--accent)] hover:text-[color:var(--accent-2)]" href="/teacher">
              Profesor
            </Link>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Link className="px-2 py-2 text-sm text-zinc-700 hover:text-zinc-900 sm:hidden" href="/math">
            Matematică
          </Link>
          <Link className="px-2 py-2 text-sm text-zinc-700 hover:text-zinc-900 sm:hidden" href="/physics">
            Fizică
          </Link>
          <Link className="px-2 py-2 text-sm text-zinc-700 hover:text-zinc-900 sm:hidden" href="/chemistry">
            Chimie
          </Link>
          {user ? (
            <Link className="px-2 py-2 text-sm text-zinc-700 hover:text-zinc-900 sm:hidden" href="/notifications">
              Notificări{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
            </Link>
          ) : null}
          <ThemeToggle />
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
                <span className={`px-1 text-sm hover:text-zinc-900 ${usernameColorClass(user.username) || "text-zinc-700"}`}>@{user.username}</span>
              </Link>
              <Link
                className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 md:inline"
                href="/settings"
              >
                Setări
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button variant="secondary" size="sm" type="submit">
                  Deconectare
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Autentifică-te
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Creează cont</Button>
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}

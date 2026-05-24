"use client";

import * as React from "react";
import Link from "next/link";

type Props = {
  initialUnreadCount: number;
};

export function NavbarNotificationsLink({ initialUnreadCount }: Props) {
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);

  React.useEffect(() => {
    let alive = true;
    async function refresh() {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { unreadCount?: number };
      if (!alive) return;
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    }

    const id = setInterval(() => {
      void refresh();
    }, 12000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/notifications">
      Notificări{unreadCount > 0 ? ` (${unreadCount})` : ""}
    </Link>
  );
}

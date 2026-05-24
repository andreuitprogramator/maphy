"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type NotificationRow = {
  id: string;
  type: "FOLLOWED_YOU" | "FOLLOWING_USER_SUBMITTED" | "NEW_PROBLEM_PUBLISHED";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  targetUrl: string | null;
  actor: { username: string; avatarUrl: string | null } | null;
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(ms / 1000));
  if (sec < 60) return `acum ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `acum ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `acum ${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `acum ${d}z`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsList({
  initialRows,
  initialUnreadCount,
}: {
  initialRows: NotificationRow[];
  initialUnreadCount: number;
}) {
  const [rows, setRows] = React.useState(initialRows);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [pendingAll, setPendingAll] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/notifications?limit=50", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { notifications?: NotificationRow[]; unreadCount?: number };
    setRows(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, 12000);
    return () => clearInterval(id);
  }, [refresh]);

  async function markOneRead(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.isRead) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: true } : r)));
    setUnreadCount((n) => Math.max(0, n - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
  }

  async function markAllRead() {
    setPendingAll(true);
    const res = await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
    setPendingAll(false);
    if (!res.ok) return;
    setRows((prev) => prev.map((r) => ({ ...r, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2">
        <div className="text-sm text-zinc-700">
          Necitite: <span className="font-semibold text-zinc-900">{unreadCount}</span>
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={pendingAll || unreadCount === 0} onClick={markAllRead}>
          Marchează toate ca citite
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
          Nicio notificare încă.
        </div>
      ) : (
        <div className="grid gap-2">
          {rows.map((n) => {
            const content = (
              <div
                className={`rounded-xl border px-3 py-3 transition ${
                  n.isRead ? "border-zinc-200 bg-white" : "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50">
                    {n.actor?.avatarUrl ? (
                      <Image src={n.actor.avatarUrl} alt="" fill className="object-cover" sizes="36px" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-xs font-semibold text-zinc-500">
                        {(n.actor?.username?.slice(0, 1) ?? "N").toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-zinc-900">{n.title}</div>
                      <div className="shrink-0 text-xs text-zinc-500">{relativeTime(n.createdAt)}</div>
                    </div>
                    <div className="mt-1 text-sm text-zinc-700">{n.body}</div>
                  </div>
                </div>
              </div>
            );

            if (n.targetUrl) {
              return (
                <Link key={n.id} href={n.targetUrl} onClick={() => void markOneRead(n.id)}>
                  {content}
                </Link>
              );
            }

            return (
              <button key={n.id} type="button" onClick={() => void markOneRead(n.id)} className="text-left">
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

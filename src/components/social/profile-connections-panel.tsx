"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { FollowButton } from "@/components/profile/follow-button";
import { MessageUserButton } from "@/components/social/message-user-button";

type Row = { username: string; avatarUrl: string | null; isYou: boolean; isFollowing: boolean };

export function ProfileConnectionsPanel({
  username,
  followersCount,
  followingCount,
  currentUsername,
}: {
  username: string;
  followersCount: number;
  followingCount: number;
  currentUsername: string | null;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [mode, setMode] = React.useState<"followers" | "following" | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mode]);

  async function open(type: "followers" | "following") {
    setMode(type);
    setLoading(true);
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/connections?type=${type}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setRows([]);
      return;
    }
    setRows((data.users ?? []) as Row[]);
  }

  const modal =
    mounted && mode ? (
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connections-dialog-title"
      >
        <button
          type="button"
          className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[1px]"
          aria-label="Close dialog"
          onClick={() => setMode(null)}
        />
        <div
          className="relative z-10 flex max-h-[min(85vh,560px)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
            <h2 id="connections-dialog-title" className="text-sm font-semibold text-zinc-900">
              {mode === "followers" ? "Followers" : "Following"}
            </h2>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">No users yet.</div>
            ) : (
              <ul className="grid gap-2">
                {rows.map((u) => {
                  const showFollow = Boolean(currentUsername) && !u.isYou;
                  return (
                    <li
                      key={u.username}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3"
                    >
                      <Link href={`/u/${u.username}`} className="flex min-w-0 items-center gap-2" onClick={() => setMode(null)}>
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-white">
                          {u.avatarUrl ? (
                            <Image src={u.avatarUrl} alt="" fill className="object-cover" sizes="36px" />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-xs font-semibold text-zinc-500">
                              {u.username.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="truncate text-sm font-medium text-zinc-900">@{u.username}</span>
                      </Link>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        {showFollow ? <FollowButton username={u.username} initialFollowing={u.isFollowing} /> : null}
                        {!u.isYou && currentUsername ? <MessageUserButton username={u.username} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-center">
        <button
          type="button"
          onClick={() => void open("followers")}
          className="rounded-xl border border-zinc-200 p-2 transition-colors hover:bg-zinc-50"
        >
          <div className="text-sm font-semibold text-zinc-900">{followersCount}</div>
          <div className="text-xs text-zinc-600">Followers</div>
        </button>
        <button
          type="button"
          onClick={() => void open("following")}
          className="rounded-xl border border-zinc-200 p-2 transition-colors hover:bg-zinc-50"
        >
          <div className="text-sm font-semibold text-zinc-900">{followingCount}</div>
          <div className="text-xs text-zinc-600">Following</div>
        </button>
      </div>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}

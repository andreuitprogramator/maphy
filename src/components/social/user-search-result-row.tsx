"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { FollowButton } from "@/components/profile/follow-button";
import type { UserSearchHit } from "@/lib/social/search-types";
import { usernameColorClass } from "@/lib/ui/username-color";

export function UserSearchResultRow({
  user,
  currentUsername,
}: {
  user: UserSearchHit;
  currentUsername: string | null;
}) {
  const [followerCount, setFollowerCount] = React.useState(user.followerCount);

  React.useEffect(() => {
    setFollowerCount(user.followerCount);
  }, [user.followerCount, user.username]);

  const loggedIn = Boolean(currentUsername);
  const showFollow = loggedIn && !user.isYou;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
      <Link
        href={`/u/${user.username}`}
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
      >
        {user.avatarUrl ? (
          <Image src={user.avatarUrl} alt="" fill className="object-cover" sizes="44px" />
        ) : (
          <span className="grid h-full w-full place-items-center text-xs font-semibold text-zinc-500">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/u/${user.username}`} className={`text-sm font-semibold hover:underline ${usernameColorClass(user.username) || "text-zinc-900"}`}>
            @{user.username}
          </Link>
          {user.displayName ? (
            <span className="text-sm text-zinc-600">{user.displayName}</span>
          ) : null}
          {user.isYou ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Tu</span>
          ) : null}
        </div>
        <div className="text-xs text-zinc-600">
          {followerCount} urmăritor{followerCount === 1 ? "" : "i"}
        </div>
        {user.subtitle ? (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-700">{user.subtitle}</p>
        ) : (
          <p className="mt-1 text-xs italic text-zinc-400">Nicio descriere sau școală adăugată.</p>
        )}
      </div>
      {showFollow ? (
        <div className="flex items-center gap-1">
          <FollowButton
            username={user.username}
            initialFollowing={user.isFollowing}
            onFollowChange={({ followersCount }) => {
              if (typeof followersCount === "number") setFollowerCount(followersCount);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

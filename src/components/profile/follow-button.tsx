"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FollowButton({
  username,
  initialFollowing,
  disabled,
  onFollowChange,
}: {
  username: string;
  initialFollowing: boolean;
  disabled?: boolean;
  /** Fires after a successful follow/unfollow (server counts included when available). */
  onFollowChange?: (next: { following: boolean; followersCount?: number }) => void;
}) {
  const router = useRouter();
  const [following, setFollowing] = React.useState(initialFollowing);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  async function toggle() {
    setPending(true);
    const res = following
      ? await fetch(`/api/follow?username=${encodeURIComponent(username)}`, { method: "DELETE" })
      : await fetch(`/api/follow`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username }),
        });
    setPending(false);
    if (!res.ok) return;

    let followersCount: number | undefined;
    try {
      const data = (await res.json()) as { followersCount?: number };
      if (typeof data.followersCount === "number") followersCount = data.followersCount;
    } catch {
      /* ignore */
    }

    const nextFollowing = !following;
    setFollowing(nextFollowing);
    router.refresh();
    onFollowChange?.(
      typeof followersCount === "number"
        ? { following: nextFollowing, followersCount }
        : { following: nextFollowing },
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "secondary" : "primary"}
      disabled={disabled || pending}
      onClick={toggle}
    >
      {pending ? "…" : following ? "Following" : "Follow"}
    </Button>
  );
}

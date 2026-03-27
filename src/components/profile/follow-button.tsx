"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function FollowButton({
  username,
  initialFollowing,
  disabled,
}: {
  username: string;
  initialFollowing: boolean;
  disabled?: boolean;
}) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [pending, setPending] = React.useState(false);

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
    if (res.ok) setFollowing(!following);
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "secondary" : "primary"}
      disabled={disabled || pending}
      onClick={toggle}
    >
      {pending ? "..." : following ? "Following" : "Follow"}
    </Button>
  );
}


"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MessageUserButton({ username }: { username: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/messages/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not start chat");
      return;
    }
    if (data?.conversationId) {
      router.push(`/messages?conversation=${encodeURIComponent(data.conversationId)}`);
      return;
    }
    router.push("/messages");
  }

  return (
    <div className="grid gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onClick}>
        {pending ? "Opening..." : "Message"}
      </Button>
      {error ? <div className="max-w-48 text-right text-[11px] text-red-600">{error}</div> : null}
    </div>
  );
}

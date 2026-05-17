"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type ConversationRow = {
  id: string;
  otherUser: { id: string; username: string; avatarUrl: string | null } | null;
  lastMessage: { body: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
  updatedAt: string;
};

type MessageRow = { id: string; senderId: string; body: string; createdAt: string };
type SuggestionUser = { username: string; avatarUrl: string | null };

export function MessagesClient({
  meId,
  initialConversations,
  initialConversationId,
}: {
  meId: string;
  initialConversations: ConversationRow[];
  initialConversationId: string | null;
}) {
  const [conversations, setConversations] = React.useState(initialConversations);
  const [activeId, setActiveId] = React.useState<string | null>(initialConversationId);
  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [pending, setPending] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [startQuery, setStartQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<SuggestionUser[]>([]);
  const [starting, setStarting] = React.useState<string | null>(null);

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const loadConversations = React.useCallback(async () => {
    const res = await fetch("/api/messages");
    if (!res.ok) return;
    const data = await res.json();
    setConversations((data.conversations ?? []) as ConversationRow[]);
  }, []);

  const loadThread = React.useCallback(async () => {
    if (!activeId) return;
    const res = await fetch(`/api/messages/${activeId}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages((data.messages ?? []) as MessageRow[]);
    await loadConversations();
  }, [activeId, loadConversations]);

  React.useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0]!.id);
  }, [activeId, conversations]);

  React.useEffect(() => {
    void loadThread();
  }, [loadThread]);

  React.useEffect(() => {
    const t = setInterval(() => void loadConversations(), 5000);
    return () => clearInterval(t);
  }, [loadConversations]);

  React.useEffect(() => {
    const t = window.setTimeout(async () => {
      if (startQuery.trim().length === 0) {
        const res = await fetch("/api/messages/suggestions");
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions((data.users ?? []) as SuggestionUser[]);
        return;
      }
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(startQuery.trim())}`);
      if (!res.ok) return;
      const data = await res.json();
      const users = ((data.users ?? []) as Array<{ username: string; avatarUrl: string | null; isYou: boolean }>)
        .filter((u) => !u.isYou)
        .map((u) => ({ username: u.username, avatarUrl: u.avatarUrl }));
      setSuggestions(users);
    }, 250);
    return () => window.clearTimeout(t);
  }, [startQuery]);

  React.useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => void loadThread(), 2500);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setError(null);
    setPending(true);
    const res = await fetch(`/api/messages/${activeId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not send");
      return;
    }
    setBody("");
    await loadThread();
  }

  async function startConversation(username: string) {
    setStarting(username);
    setError(null);
    const res = await fetch("/api/messages/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    setStarting(null);
    if (!res.ok) {
      setError(data?.error ?? "Could not start conversation");
      return;
    }
    await loadConversations();
    if (data?.conversationId) setActiveId(data.conversationId);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-900">Conversations</div>
        <div className="grid gap-2 p-2">
          <div className="grid gap-1">
            <input
              value={startQuery}
              onChange={(e) => setStartQuery(e.target.value)}
              placeholder="Search user to message..."
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs"
            />
            {suggestions.length > 0 ? (
              <div className="grid gap-1">
                {suggestions.slice(0, 6).map((u) => (
                  <button
                    key={u.username}
                    type="button"
                    disabled={starting === u.username}
                    onClick={() => void startConversation(u.username)}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    {starting === u.username ? "Opening..." : `Message @${u.username}`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {conversations.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-zinc-500">No conversations yet.</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`rounded-lg px-3 py-2 text-left ${
                  activeId === c.id ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-zinc-900">
                    @{c.otherUser?.username ?? "Unknown"}
                  </div>
                  {c.unreadCount > 0 ? (
                    <span className="rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {c.unreadCount}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-zinc-600">{c.lastMessage?.body ?? "No messages yet"}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-900">
          {activeConversation ? `Chat with @${activeConversation.otherUser?.username ?? "Unknown"}` : "Select a conversation"}
        </div>
        <div className="grid h-[65vh] grid-rows-[1fr_auto]">
          <div className="space-y-2 overflow-y-auto p-3">
            {activeId ? (
              messages.length === 0 ? (
                <div className="text-sm text-zinc-500">No messages yet.</div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === meId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-[color:var(--accent)] text-white" : "bg-zinc-100 text-zinc-900"}`}>
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className={`mt-1 text-[10px] ${mine ? "text-white/80" : "text-zinc-500"}`}>
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              <div className="text-sm text-zinc-500">Choose a conversation from the left.</div>
            )}
          </div>
          <form onSubmit={sendMessage} className="border-t border-zinc-200 p-3">
            <div className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message..."
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                disabled={!activeId || pending}
              />
              <Button type="submit" disabled={!activeId || pending}>
                Send
              </Button>
            </div>
            {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}

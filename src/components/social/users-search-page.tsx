"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/layout/container";
import { useDebouncedUserSearch } from "@/components/social/use-debounced-user-search";
import { UserSearchResultRow } from "@/components/social/user-search-result-row";

export function UsersSearchPage({
  currentUsername,
  initialQuery,
}: {
  currentUsername: string | null;
  initialQuery: string;
}) {
  const router = useRouter();
  const { query, setQuery, debouncedQuery, users, loading, clear } = useDebouncedUserSearch({
    initialQuery,
  });

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      const q = debouncedQuery.trim();
      const next = q ? `/users?q=${encodeURIComponent(q)}` : "/users";
      router.replace(next, { scroll: false });
    }, 400);
    return () => window.clearTimeout(t);
  }, [debouncedQuery, router]);

  return (
    <Container className="py-8">
      <div className="mx-auto grid max-w-2xl gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Find users</h2>
          <p className="text-sm text-zinc-600">Search by username (partial match, not case-sensitive).</p>
        </div>

        <div className="relative">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a username…"
            autoComplete="off"
            aria-label="Search users"
            className="pr-10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => clear()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 hover:text-zinc-900"
            >
              Clear
            </button>
          ) : null}
        </div>

        {debouncedQuery.length < 1 ? (
          <p className="text-center text-sm text-zinc-500">Start typing to see matches.</p>
        ) : loading ? (
          <p className="text-center text-sm text-zinc-600">Searching…</p>
        ) : users.length === 0 ? (
          <p className="text-center text-sm text-zinc-600">No users found.</p>
        ) : (
          <ul className="grid gap-3">
            {users.map((u) => (
              <li key={u.username}>
                <UserSearchResultRow user={u} currentUsername={currentUsername} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}

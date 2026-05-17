"use client";

import * as React from "react";
import type { UserSearchHit } from "@/lib/social/search-types";

export function useDebouncedUserSearch(opts: { initialQuery?: string; debounceMs?: number } = {}) {
  const { initialQuery = "", debounceMs = 320 } = opts;
  const [query, setQuery] = React.useState(initialQuery);
  const [debounced, setDebounced] = React.useState(initialQuery.trim());
  const [users, setUsers] = React.useState<UserSearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), debounceMs);
    return () => window.clearTimeout(t);
  }, [query, debounceMs]);

  React.useEffect(() => {
    if (debounced.length < 1) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/users/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((d: { users?: UserSearchHit[] }) => {
        if (!cancelled) setUsers(Array.isArray(d.users) ? d.users : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const clear = React.useCallback(() => setQuery(""), []);

  return { query, setQuery, debouncedQuery: debounced, users, loading, clear };
}

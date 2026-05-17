import { getSessionUser } from "@/lib/auth/session";
import { UsersSearchPage } from "@/components/social/users-search-page";

export const dynamic = "force-dynamic";

type Search = { [key: string]: string | string[] | undefined };

function getFirst(search: Search, key: string) {
  const v = search[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = getFirst(sp, "q");
  const initialQuery = typeof q === "string" ? q.trim() : "";
  const me = await getSessionUser();

  return <UsersSearchPage currentUsername={me?.username ?? null} initialQuery={initialQuery} />;
}

import { LoginClient } from "@/components/auth/login-client";

export const dynamic = "force-dynamic";

type Search = { [key: string]: string | string[] | undefined };

function getFirst(search: Search, key: string) {
  const v = search[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const raw = getFirst(sp, "next");
  const next =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/problems";

  return <LoginClient nextHref={next} />;
}

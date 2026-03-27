import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export async function Navbar() {
  const user = await getSessionUser();

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[color:var(--accent)] text-white font-semibold">
            M
          </span>
          <span className="font-semibold tracking-tight text-zinc-900">Maphy</span>
        </Link>

        <nav className="hidden items-center gap-2 sm:flex">
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/problems">
            Problems
          </Link>
          <Link className="px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900" href="/leaderboard">
            Leaderboard
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                className="hidden sm:inline-flex px-3 py-2 text-sm text-zinc-700 hover:text-zinc-900"
                href={`/u/${user.username}`}
              >
                @{user.username}
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button variant="secondary" size="sm" type="submit">
                  Logout
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Create account</Button>
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}


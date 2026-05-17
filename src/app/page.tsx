import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getSessionUser();
  return (
    <Container className="py-10 sm:py-14">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10 items-start">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Practice olympiad math & physics — fast submissions, clean leaderboards.
          </h1>
          <p className="text-zinc-600 leading-relaxed">
            Maphy is inspired by Kilonova and pbinfo, but focused on olympiad-style problem statements and
            photo submissions from phone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/problems">
              <Button size="lg">Browse problems</Button>
            </Link>
            {!user ? (
              <Link href="/register">
                <Button size="lg" variant="secondary">
                  Create account
                </Button>
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-zinc-500">
            Tip: On mobile, upload directly from gallery or camera.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">What’s included</div>
            <div className="text-sm text-zinc-600">
              Auth + Prisma models + problem list/detail + image submissions + leaderboards.
            </div>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm text-zinc-700">
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                JWT sessions (httpOnly cookie) + profile pages
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                Problem filters (subject/year/class/phase)
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                Submissions with local image storage + basic rate limiting
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

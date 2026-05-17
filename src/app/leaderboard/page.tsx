import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  GLOBAL_LEADERBOARD_MODE_LABELS,
  type GlobalLeaderboardMode,
  getGlobalLeaderboard,
  parseGlobalLeaderboardMode,
} from "@/lib/leaderboards/global";

export const dynamic = "force-dynamic";

type Search = { [key: string]: string | string[] | undefined };

function getFirst(search: Search, key: string) {
  const v = search[key];
  return Array.isArray(v) ? v[0] : v;
}

const TABS: { mode: GlobalLeaderboardMode; short: string }[] = [
  { mode: "perfect", short: "Perfect (100)" },
  { mode: "95", short: "95+" },
  { mode: "85", short: "85+" },
  { mode: "75", short: "75+" },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const mode = parseGlobalLeaderboardMode(getFirst(sp, "mode"));
  const { leaderboard: rows } = await getGlobalLeaderboard(mode);

  return (
    <Container className="py-8">
      <div className="grid gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Global leaderboard</h2>
          <p className="text-sm text-zinc-600">
            Choose a ranking mode. Only graded submissions use{" "}
            <span className="font-medium text-zinc-800">aiScore</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.mode}
              href={`/leaderboard?mode=${t.mode}`}
              scroll={false}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                mode === t.mode
                  ? "border-[color:var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_12%,white)] text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              )}
            >
              {t.short}
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">{GLOBAL_LEADERBOARD_MODE_LABELS[mode]}</div>
            <div className="text-sm text-zinc-600">Top 50 users for this ranking.</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-600">No graded submissions yet.</div>
            ) : (
              rows.map((r, idx) => (
                <div
                  key={r.username}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <span className="tabular-nums text-zinc-500">{idx + 1}.</span>{" "}
                    <span className="inline-flex items-center gap-2 align-middle">
                      {r.avatarUrl ? (
                        <span className="relative inline-block h-8 w-8 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 align-middle">
                          <Image src={r.avatarUrl} alt="" fill className="object-cover" sizes="32px" />
                        </span>
                      ) : (
                        <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600">
                          {r.username.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <Link className="font-medium text-zinc-900 hover:underline" href={`/u/${r.username}`}>
                        @{r.username}
                      </Link>
                    </span>
                    <div className="mt-1 text-xs text-zinc-600">
                      Avg <span className="tabular-nums font-medium">{r.avgScore.toFixed(1)}</span>
                      {" · "}
                      Graded <span className="tabular-nums font-medium">{r.totalGraded}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-900">
                      100: {r.count100}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-800">
                      95+: {r.count95}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-800">
                      85+: {r.count85}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-800">
                      75+: {r.count75}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

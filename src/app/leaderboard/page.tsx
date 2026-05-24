import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { usernameColorClass } from "@/lib/ui/username-color";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  GLOBAL_LEADERBOARD_MODES,
  GLOBAL_LEADERBOARD_MODE_LABELS,
  LEADERBOARD_SUBJECTS,
  LEADERBOARD_SUBJECT_LABELS,
  type GlobalLeaderboardMode,
  type LeaderboardSubject,
  getGlobalLeaderboard,
  parseGlobalLeaderboardMode,
  parseLeaderboardSubject,
} from "@/lib/leaderboards/global";

export const dynamic = "force-dynamic";

type Search = { [key: string]: string | string[] | undefined };
function getFirst(search: Search, key: string) {
  const v = search[key];
  return Array.isArray(v) ? v[0] : v;
}

const MODE_VALUE_LABEL: Record<GlobalLeaderboardMode, string> = {
  p100: "100p",
  p70: "70p+",
  streak: "zile",
  sets: "subiecte",
};

const MODE_VALUE_COLOR: Record<GlobalLeaderboardMode, string> = {
  p100: "text-emerald-500",
  p70: "text-amber-500",
  streak: "text-sky-500",
  sets: "text-violet-500",
};

const SUBJECT_COLORS: Record<LeaderboardSubject, string> = {
  ALL: "border-zinc-200 bg-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700",
  MATH: "border-zinc-200 bg-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700",
  PHYSICS: "border-zinc-200 bg-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700",
  CHEMISTRY: "border-zinc-200 bg-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700",
};

const SUBJECT_COLORS_ACTIVE: Record<LeaderboardSubject, string> = {
  ALL: "border-zinc-400 bg-zinc-500/10 text-zinc-300",
  MATH: "border-violet-400/60 bg-violet-500/10 text-violet-400",
  PHYSICS: "border-sky-400/60 bg-sky-500/10 text-sky-400",
  CHEMISTRY: "border-green-400/60 bg-green-500/10 text-green-400",
};

// Modes where subject filter applies
const SUBJECT_FILTER_MODES: GlobalLeaderboardMode[] = ["p100", "p70", "sets"];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const mode = parseGlobalLeaderboardMode(getFirst(sp, "mode"));
  const subject = parseLeaderboardSubject(getFirst(sp, "subject"));

  const effectiveSubject = SUBJECT_FILTER_MODES.includes(mode) ? subject : "ALL";
  const { leaderboard: rows } = await getGlobalLeaderboard(mode, effectiveSubject);

  function modeHref(m: GlobalLeaderboardMode) {
    const s = SUBJECT_FILTER_MODES.includes(m) ? subject : "ALL";
    return `/leaderboard?mode=${m}${s !== "ALL" ? `&subject=${s}` : ""}`;
  }

  function subjectHref(s: LeaderboardSubject) {
    return `/leaderboard?mode=${mode}&subject=${s}`;
  }

  return (
    <Container className="py-8">
      <div className="grid gap-6 max-w-2xl mx-auto">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clasament global</h2>
          <p className="text-sm text-zinc-600">Top 50 utilizatori pe fiecare categorie.</p>
        </div>

        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2">
          {GLOBAL_LEADERBOARD_MODES.map((m) => (
            <Link
              key={m}
              href={modeHref(m)}
              scroll={false}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                mode === m
                  ? "border-[color:var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_15%,var(--surface))] text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              )}
            >
              {GLOBAL_LEADERBOARD_MODE_LABELS[m]}
            </Link>
          ))}
        </div>

        {/* Subject filter — only for p100, p70, sets */}
        {SUBJECT_FILTER_MODES.includes(mode) && (
          <div className="flex flex-wrap gap-2">
            {LEADERBOARD_SUBJECTS.map((s) => (
              <Link
                key={s}
                href={subjectHref(s)}
                scroll={false}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  subject === s ? SUBJECT_COLORS_ACTIVE[s] : SUBJECT_COLORS[s],
                )}
              >
                {LEADERBOARD_SUBJECT_LABELS[s]}
              </Link>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">
              {GLOBAL_LEADERBOARD_MODE_LABELS[mode]}
              {effectiveSubject !== "ALL" && (
                <span className="ml-2 text-zinc-500">— {LEADERBOARD_SUBJECT_LABELS[effectiveSubject]}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-600">Nicio intrare încă.</div>
            ) : (
              rows.map((r, idx) => (
                <div
                  key={r.username}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5"
                >
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-400">{idx + 1}.</span>

                  {r.avatarUrl ? (
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50">
                      <Image src={r.avatarUrl} alt="" fill className="object-cover" sizes="32px" />
                    </span>
                  ) : (
                    <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600">
                      {r.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <Link className={`min-w-0 flex-1 text-sm font-medium hover:underline ${usernameColorClass(r.username) || "text-zinc-900"}`} href={`/u/${r.username}`}>
                    @{r.username}
                  </Link>

                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className={`text-lg font-bold tabular-nums ${MODE_VALUE_COLOR[mode]}`}>
                      {r[mode === "sets" ? "sets" : mode === "streak" ? "streak" : mode === "p100" ? "p100" : "p70"]}
                    </span>
                    <span className="text-xs text-zinc-400">{MODE_VALUE_LABEL[mode]}</span>
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

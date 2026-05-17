import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { fetchEnrichedProblems } from "@/lib/problems/problem-list-data";
import { parseProblemSort, PROBLEM_SORT_OPTIONS } from "@/lib/problems/sort";

const subjects = [
  { value: "", label: "All" },
  { value: "MATH", label: "Math" },
  { value: "PHYSICS", label: "Physics" },
] as const;

const phases = [
  { value: "", label: "All" },
  { value: "LOCAL", label: "Local" },
  { value: "COUNTY", label: "County" },
  { value: "NATIONAL", label: "National" },
] as const;

const POPULAR_MIN_SUBMISSIONS = 20;
const TOP_RATED_MIN = 9;
const TOP_RATED_MIN_COUNT = 3;

type Search = { [key: string]: string | string[] | undefined };

function getFirst(search: Search, key: string) {
  const v = search[key];
  return Array.isArray(v) ? v[0] : v;
}

function progressLabel(stats: { mySubmissionCount: number; hasPerfect100: boolean }) {
  if (stats.hasPerfect100) return { text: "Solved (100)", className: "bg-emerald-100 text-emerald-900" };
  if (stats.mySubmissionCount > 0) return { text: "Attempted", className: "bg-amber-50 text-amber-950" };
  return { text: "Not tried", className: "bg-zinc-100 text-zinc-700" };
}

export type ProblemsHubConfig = {
  title: string;
  subtitle: string;
  accentClass: string;
  chips: string[];
  emptyText: string;
  subjectPreset?: "MATH" | "PHYSICS";
  basePath: string;
};

export async function ProblemsHub({
  searchParams,
  config,
}: {
  searchParams: Promise<Search>;
  config: ProblemsHubConfig;
}) {
  const sp = await searchParams;
  const subject = getFirst(sp, "subject");
  const year = getFirst(sp, "year");
  const cls = getFirst(sp, "class");
  const phase = getFirst(sp, "phase");
  const sort = parseProblemSort(getFirst(sp, "sort"));

  const where: Prisma.ProblemWhereInput = { status: ProblemStatus.PUBLISHED };
  if (config.subjectPreset) where.subject = config.subjectPreset;
  if (!config.subjectPreset && (subject === "MATH" || subject === "PHYSICS")) where.subject = subject;
  if (phase === "LOCAL" || phase === "COUNTY" || phase === "NATIONAL") where.phase = phase;
  if (year && /^\d+$/.test(year)) where.year = Number(year);
  if (cls && /^\d+$/.test(cls)) where.class = Number(cls);

  const me = await getSessionUser();
  const problems = await fetchEnrichedProblems(where, sort, me?.id ?? null);

  const years = Array.from(
    new Set(
      (
        await prisma.problem.findMany({
          where: { status: ProblemStatus.PUBLISHED, ...(config.subjectPreset ? { subject: config.subjectPreset } : {}) },
          select: { year: true },
        })
      ).map((p) => p.year),
    ),
  )
    .sort((a, b) => b - a)
    .slice(0, 25);

  return (
    <Container className="py-8">
      <div className="flex flex-col gap-6">
        <Card className={cn("border-2", config.accentClass)}>
          <CardHeader>
            <h2 className="text-2xl font-semibold tracking-tight">{config.title}</h2>
            <p className="text-sm text-zinc-600">{config.subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {config.chips.map((chip) => (
                <span key={chip} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700">
                  {chip}
                </span>
              ))}
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Filters & sort</div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {!config.subjectPreset ? (
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Subject</label>
                <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" defaultValue={subject ?? ""} name="subject" form="filters">
                  {subjects.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-1">
              <label className="text-xs text-zinc-600">Year</label>
              <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" defaultValue={year ?? ""} name="year" form="filters">
                <option value="">All</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-zinc-600">Class</label>
              <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" defaultValue={cls ?? ""} name="class" form="filters">
                <option value="">All</option>
                {Array.from({ length: 8 }).map((_, i) => (
                  <option key={i + 5} value={i + 5}>
                    {i + 5}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-zinc-600">Phase</label>
              <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" defaultValue={phase ?? ""} name="phase" form="filters">
                {phases.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1 sm:col-span-2 lg:col-span-2">
              <label className="text-xs text-zinc-600">Sort by</label>
              <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" defaultValue={sort} name="sort" form="filters">
                {PROBLEM_SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <form id="filters" className="lg:col-span-6 flex flex-wrap gap-2 pt-1" method="get">
              <button className="h-10 rounded-xl bg-[color:var(--accent)] px-4 text-sm font-medium text-white hover:bg-[color:var(--accent-2)]">
                Apply
              </button>
              <Link className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-medium grid place-items-center hover:bg-zinc-50" href={config.basePath}>
                Reset
              </Link>
              <div className="text-sm text-zinc-500 self-center">{problems.length} problems</div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => {
            const { stats } = p;
            const prog = progressLabel(stats);
            const popular = stats.submissionCount >= POPULAR_MIN_SUBMISSIONS;
            const topRated = stats.ratingAvg != null && stats.ratingAvg >= TOP_RATED_MIN && stats.ratingCount >= TOP_RATED_MIN_COUNT;
            const subjectTone = p.subject === "MATH" ? "bg-violet-100 text-violet-900" : "bg-sky-100 text-sky-900";

            return (
              <Link key={p.id} href={`/problems/${p.id}`} className="group">
                <Card className="h-full hover:border-zinc-300">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", subjectTone)}>
                        {p.subject === "MATH" ? "Math" : "Physics"}
                      </span>
                      {popular ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
                          Popular
                        </span>
                      ) : null}
                      {topRated ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                          Top rated
                        </span>
                      ) : null}
                      {me ? (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", prog.className)}>
                          {prog.text}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm font-semibold text-zinc-900 group-hover:text-[color:var(--accent)]">{p.title}</div>
                    <div className="text-xs text-zinc-600">
                      {p.year} · Class {p.class} · {p.phase.toLowerCase()}
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-xs text-zinc-700">
                    <div className="inline-flex w-fit items-center rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-800">
                      Difficulty {p.difficulty}/10
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        <span className="font-medium text-zinc-900">{stats.submissionCount}</span> submits
                      </span>
                      {stats.ratingCount > 0 && stats.ratingAvg != null ? (
                        <span>
                          ★ <span className="font-semibold tabular-nums">{stats.ratingAvg.toFixed(1)}</span>/10
                          <span className="text-zinc-500"> ({stats.ratingCount})</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">No ratings yet</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {problems.length === 0 ? (
          <Card>
            <CardContent className={cn("py-10 text-center text-sm text-zinc-600")}>{config.emptyText}</CardContent>
          </Card>
        ) : null}
      </div>
    </Container>
  );
}


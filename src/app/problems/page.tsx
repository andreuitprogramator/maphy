import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

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

type Search = { [key: string]: string | string[] | undefined };

function getFirst(search: Search, key: string) {
  const v = search[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const subject = getFirst(sp, "subject");
  const year = getFirst(sp, "year");
  const cls = getFirst(sp, "class");
  const phase = getFirst(sp, "phase");

  const where: Prisma.ProblemWhereInput = {};
  if (subject === "MATH" || subject === "PHYSICS") where.subject = subject;
  if (phase === "LOCAL" || phase === "COUNTY" || phase === "NATIONAL") where.phase = phase;
  if (year && /^\d+$/.test(year)) where.year = Number(year);
  if (cls && /^\d+$/.test(cls)) where.class = Number(cls);

  const problems = await prisma.problem.findMany({
    where,
    orderBy: [{ year: "desc" }, { difficulty: "asc" }],
    select: { id: true, title: true, subject: true, difficulty: true, year: true, class: true, phase: true },
  });

  const years = Array.from(new Set((await prisma.problem.findMany({ select: { year: true } })).map((p) => p.year)))
    .sort((a, b) => b - a)
    .slice(0, 25);

  return (
    <Container className="py-8">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Problems</h2>
          <p className="text-sm text-zinc-600">Filter by subject/year/class/phase.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Filters</div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="grid gap-1">
              <label className="text-xs text-zinc-600">Subject</label>
              <select
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                defaultValue={subject ?? ""}
                name="subject"
                form="filters"
              >
                {subjects.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-zinc-600">Year</label>
              <select
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                defaultValue={year ?? ""}
                name="year"
                form="filters"
              >
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
              <select
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                defaultValue={cls ?? ""}
                name="class"
                form="filters"
              >
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
              <select
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                defaultValue={phase ?? ""}
                name="phase"
                form="filters"
              >
                {phases.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <form id="filters" className="sm:col-span-4 flex flex-wrap gap-2 pt-1" method="get">
              <button className="h-10 rounded-xl bg-[color:var(--accent)] px-4 text-sm font-medium text-white hover:bg-[color:var(--accent-2)]">
                Apply
              </button>
              <Link className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-medium grid place-items-center hover:bg-zinc-50" href="/problems">
                Reset
              </Link>
              <div className="text-sm text-zinc-500 self-center">{problems.length} problems</div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => (
            <Link key={p.id} href={`/problems/${p.id}`} className="group">
              <Card className="h-full hover:border-zinc-300">
                <CardHeader>
                  <div className="text-sm font-semibold text-zinc-900 group-hover:text-[color:var(--accent)]">
                    {p.title}
                  </div>
                  <div className="text-xs text-zinc-600">
                    {p.subject === "MATH" ? "Math" : "Physics"} · {p.year} · Class {p.class} ·{" "}
                    {p.phase.toLowerCase()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    Difficulty {p.difficulty}/10
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {problems.length === 0 ? (
          <Card>
            <CardContent className={cn("py-10 text-center text-sm text-zinc-600")}>
              No problems match these filters yet.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Container>
  );
}


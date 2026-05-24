import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ContestStage } from "@prisma/client";
import { Container } from "@/components/layout/container";
import { ContestSetsFilterBar } from "@/components/contest-sets/contest-sets-filter-bar";
import { Suspense } from "react";

const STAGE_LABELS: Record<string, string> = {
  LOCAL: "Locală",
  COUNTY: "Județeană",
  NATIONAL: "Națională",
  SELECTION: "Selecție",
  FINAL_ROUND: "Runda Finală",
  INTERNATIONAL: "Internațională",
  OTHER: "Alta",
};

const STAGE_COLORS: Record<string, string> = {
  LOCAL: "bg-zinc-100 text-zinc-700",
  COUNTY: "bg-amber-100 text-amber-800",
  NATIONAL: "bg-emerald-100 text-emerald-800",
  SELECTION: "bg-blue-100 text-blue-800",
  FINAL_ROUND: "bg-violet-100 text-violet-800",
  INTERNATIONAL: "bg-rose-100 text-rose-800",
};

export type ContestSetsHubConfig = {
  subject: "MATH" | "PHYSICS" | "CHEMISTRY";
  title: string;
  subtitle: string;
  accentClass: string;
};

async function ContestSetsHubInner({
  config,
  searchParams,
}: {
  config: ContestSetsHubConfig;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const yearParam = typeof searchParams.year === "string" ? searchParams.year : "";
  const stageParam = typeof searchParams.stage === "string" ? searchParams.stage : "";
  const classParam = typeof searchParams.class === "string" ? searchParams.class : "";
  const sortParam = typeof searchParams.sort === "string" ? searchParams.sort : "";

  const where = {
    subject: config.subject,
    status: "PUBLISHED" as const,
    ...(yearParam ? { year: Number(yearParam) } : {}),
    ...(stageParam && Object.values(ContestStage).includes(stageParam as ContestStage) ? { stage: stageParam as ContestStage } : {}),
    ...(classParam && Number(classParam) > 0 ? { class: Number(classParam) } : {}),
  };

  const [sets, allSets] = await Promise.all([
    prisma.contestSet.findMany({
      where,
      orderBy: [{ year: "desc" }, { stage: "asc" }, { updatedAt: "desc" }],
      include: {
        problems: { select: { id: true } },
        _count: { select: { problems: true } },
      },
    }),
    prisma.contestSet.findMany({
      where: { subject: config.subject, status: "PUBLISHED" },
      select: { year: true, class: true },
    }),
  ]);

  const years = [...new Set(allSets.map((s) => s.year))].sort((a, b) => b - a);
  const classes = [...new Set(allSets.map((s) => s.class).filter((c) => c > 0))].sort((a, b) => a - b);

  // Aggregate star ratings per contest set
  const allProblemIds = sets.flatMap((s) => s.problems.map((p) => p.id));
  const setStars = new Map<string, number>();
  if (allProblemIds.length > 0) {
    try {
      const ratingAggs = await prisma.contestSetProblemRating.groupBy({
        by: ["contestSetProblemId"],
        where: { contestSetProblemId: { in: allProblemIds } },
        _sum: { ratingValue: true },
      });
      const ratingByProblem = new Map(
        ratingAggs.map((r) => [r.contestSetProblemId, r._sum.ratingValue ?? 0]),
      );
      for (const s of sets) {
        const total = s.problems.reduce((acc, p) => acc + (ratingByProblem.get(p.id) ?? 0), 0);
        setStars.set(s.id, total);
      }
    } catch { /* table may not exist yet */ }
  }

  let displaySets = [...sets];
  if (sortParam === "stars") {
    displaySets.sort((a, b) => (setStars.get(b.id) ?? 0) - (setStars.get(a.id) ?? 0));
  }

  return (
    <Container className="py-8">
      <div className="grid gap-6">
        {/* Header */}
        <div className="rounded-2xl border border-zinc-200 p-5 bg-[color:color-mix(in_srgb,var(--accent)_8%,var(--surface))]">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{config.title}</h1>
          <p className="mt-1 text-sm text-zinc-600">{config.subtitle}</p>
        </div>

        {/* Filters */}
        <Suspense>
          <ContestSetsFilterBar
            years={years}
            classes={classes}
            currentYear={yearParam}
            currentStage={stageParam}
            currentClass={classParam}
            currentSort={sortParam}
            subject={config.subject}
          />
        </Suspense>

        {/* Results */}
        {displaySets.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 py-12 text-center text-sm text-zinc-500">
            Niciun subiect de concurs pentru filtrele selectate.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displaySets.map((s) => {
              const stars = setStars.get(s.id) ?? 0;
              return (
                <Link key={s.id} href={`/contest-sets/${s.id}`} className="group block">
                  <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_COLORS[s.stage] ?? "bg-zinc-100 text-zinc-700"}`}>
                        {s.stage === "LOCAL" && s.subject === "PHYSICS" ? "Evrika" : (STAGE_LABELS[s.stage] ?? s.stage)}
                      </span>
                      <span className="text-xs text-zinc-400">{s.year}</span>
                      {s.class > 0 && (
                        <span className="text-xs text-zinc-400">Clasa {s.class}</span>
                      )}
                    </div>
                    <p className="mt-2 flex-1 text-sm font-semibold leading-snug text-zinc-900 group-hover:text-[color:var(--accent)]">
                      {s.title}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="text-xs text-zinc-500">{s._count.problems} probleme</p>
                      {stars > 0 && (
                        <p className="text-xs font-medium text-amber-500">★ {stars}</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Container>
  );
}

export function ContestSetsHub({
  config,
  searchParams,
}: {
  config: ContestSetsHubConfig;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <ContestSetsHubInner config={config} searchParams={searchParams} />;
}

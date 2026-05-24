import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ContestSubmissionSection } from "@/components/problems/contest-submission-section";
import { PdfTabs } from "@/components/problems/pdf-tabs";
import { scoreColorClass } from "@/lib/ui/score-color";

export const dynamic = "force-dynamic";

function stageLabel(stage: string): string {
  switch (stage) {
    case "LOCAL": return "Etapa Locală";
    case "COUNTY": return "Etapa Județeană";
    case "NATIONAL": return "Etapa Națională";
    case "SELECTION": return "Selecție";
    case "FINAL_ROUND": return "Runda Finală";
    case "INTERNATIONAL": return "Internațională";
    default: return stage;
  }
}

export default async function ContestSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, set] = await Promise.all([
    getSessionUser(),
    prisma.contestSet.findUnique({
      where: { id },
      include: { problems: { orderBy: { orderNumber: "asc" } } },
    }),
  ]);
  if (!set || set.status !== "PUBLISHED") return notFound();

  const subjectLabel = set.subject === "MATH" ? "Matematică" : set.subject === "PHYSICS" ? "Fizică" : "Chimie";

  const bestScores: Record<string, number | null> = {};
  if (user) {
    const subs = await prisma.submission.findMany({
      where: {
        userId: user.id,
        contestSetProblemId: { in: set.problems.map((p) => p.id) },
        status: "GRADED",
        aiScore: { not: null },
      },
      select: { contestSetProblemId: true, aiScore: true },
    });
    for (const s of subs) {
      if (!s.contestSetProblemId) continue;
      const cur = bestScores[s.contestSetProblemId] ?? null;
      bestScores[s.contestSetProblemId] = cur == null ? s.aiScore! : Math.max(cur, s.aiScore!);
    }
  }

  const problemStars: Record<string, number> = {};
  try {
    const ratingAggs = await prisma.contestSetProblemRating.groupBy({
      by: ["contestSetProblemId"],
      where: { contestSetProblemId: { in: set.problems.map((p) => p.id) } },
      _sum: { ratingValue: true },
    });
    for (const r of ratingAggs) {
      problemStars[r.contestSetProblemId] = r._sum.ratingValue ?? 0;
    }
  } catch { /* table may not exist yet */ }

  return (
    <Container className="py-8">
      <div className="grid gap-6 max-w-3xl mx-auto">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="text-xs text-zinc-500">{subjectLabel} · {stageLabel(set.stage)} · {set.year}</div>
            <h1 className="text-2xl font-semibold text-zinc-900">{set.title}</h1>
            <div className="text-sm text-zinc-600">{set.problems.length} probleme · scor maxim 100p/problemă</div>
          </CardHeader>
          {(set.statementPdfUrl || set.rubricPdfUrl || set.leaderboardPdfUrl) && (
            <CardContent>
              <PdfTabs
                statementPdfUrl={set.statementPdfUrl}
                rubricPdfUrl={set.rubricPdfUrl}
                leaderboardPdfUrl={set.leaderboardPdfUrl}
              />
            </CardContent>
          )}
        </Card>

        {/* Submission */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-zinc-900">Trimite o rezolvare</h2>
            <p className="text-xs text-zinc-500">
              Alege problema, fotografiază rezolvarea și trimite. AI-ul o va corecta automat.
            </p>
          </CardHeader>
          <CardContent>
            <ContestSubmissionSection
              contestSetId={set.id}
              problems={set.problems.map((p) => ({ id: p.id, orderNumber: p.orderNumber, title: p.title }))}
              loggedIn={Boolean(user)}
            />
          </CardContent>
        </Card>

        {/* Per-problem submission history links */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-zinc-900">Rezolvările tale</h2>
            <p className="text-xs text-zinc-500">Apasă pe o problemă pentru a vedea istoricul rezolvărilor și feedback-ul AI.</p>
          </CardHeader>
          <CardContent className="grid gap-2">
            {set.problems.map((p) => {
              const best = user ? (bestScores[p.id] ?? null) : null;
              const score = user ? (best ?? 0) : null;
              const stars = problemStars[p.id] ?? 0;
              return (
                <a
                  key={p.id}
                  href={`/contest-sets/${set.id}/problems/${p.orderNumber}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-3 hover:border-zinc-300 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Problema {p.orderNumber}</div>
                    {p.title !== `Problema ${p.orderNumber}` && (
                      <div className="text-xs text-zinc-500">{p.title}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {stars > 0 && (
                      <span className="text-xs font-medium text-amber-500">★ {stars}</span>
                    )}
                    {score !== null && (
                      <span className={`text-sm font-bold tabular-nums ${scoreColorClass(best)}`}>
                        {best ?? 0}<span className="text-xs font-normal text-zinc-400">/100</span>
                      </span>
                    )}
                    {score === null && (
                      <span className="text-xs text-zinc-400">Vezi rezolvările →</span>
                    )}
                  </div>
                </a>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

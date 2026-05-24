import Link from "next/link";
import { notFound } from "next/navigation";
import { scoreColorClass } from "@/lib/ui/score-color";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProblemSubmissionSection } from "@/components/problems/problem-submission-section";
import { PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE, serializePublicSubmissionsForClient, serializeSubmissionsForClient } from "@/lib/problems/submission-display";
import { ContestProblemStarRating } from "@/components/contest-sets/contest-problem-star-rating";

export const dynamic = "force-dynamic";

export default async function ContestSetProblemPage({ params }: { params: Promise<{ id: string; order: string }> }) {
  const { id, order } = await params;
  const orderNumber = Number(order);
  if (!Number.isFinite(orderNumber)) return notFound();

  const [user, row] = await Promise.all([
    getSessionUser(),
    prisma.contestSetProblem.findFirst({
      where: { contestSetId: id, orderNumber },
      select: {
        id: true,
        title: true,
        shortSummary: true,
        maxScore: true,
        contestSet: { select: { id: true, title: true, subject: true, status: true, statementPdfUrl: true, rubricPdfUrl: true } },
      },
    }),
  ]);
  if (!row || row.contestSet.status !== "PUBLISHED") return notFound();

  const viewerUnlockedPeerImages = user
    ? Boolean(await prisma.submission.findFirst({ where: { userId: user.id, contestSetProblemId: row.id, status: "GRADED", aiScore: { gte: PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE } }, select: { id: true } }))
    : false;

  const [mySubmissions, allSubmissionsRows] = await Promise.all([
    prisma.submission.findMany({
      where: { contestSetProblemId: row.id, ...(user ? { userId: user.id } : { userId: "__no_user__" }) },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: { id: true, status: true, aiScore: true, aiFeedback: true, aiBreakdown: true, imageQualityReason: true, reviewedAt: true, createdAt: true, imageUrl: true, extraImageUrls: true, user: { select: { username: true, avatarUrl: true } } },
    }),
    prisma.submission.findMany({
      where: { contestSetProblemId: row.id },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: { id: true, status: true, aiScore: true, aiFeedback: true, aiBreakdown: true, imageQualityReason: true, reviewedAt: true, createdAt: true, imageUrl: true, extraImageUrls: true, userId: true, user: { select: { username: true, avatarUrl: true } } },
    }),
  ]);

  const bestScore = user
    ? mySubmissions.reduce<number | null>((best, s) => {
        if (s.status === "GRADED" && s.aiScore != null) return best == null ? s.aiScore : Math.max(best, s.aiScore);
        return best;
      }, null)
    : null;

  const myRating = user && bestScore != null && bestScore >= 70
    ? await prisma.contestSetProblemRating.findUnique({
        where: { userId_contestSetProblemId: { userId: user.id, contestSetProblemId: row.id } },
        select: { ratingValue: true },
      }).catch(() => null)
    : null;

  const initialMySubmissions = serializeSubmissionsForClient(mySubmissions);
  const initialAllSubmissions = serializePublicSubmissionsForClient(
    allSubmissionsRows.map((r) => {
      const isOwn = user?.id === r.userId;
      const canViewImage = isOwn || viewerUnlockedPeerImages;
      return { ...r, imageUrl: canViewImage ? r.imageUrl : null, canViewImage };
    }),
  );

  return (
    <Container className="py-8">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="text-xs text-zinc-600">
              <Link href={row.contestSet.subject === "MATH" ? "/math" : row.contestSet.subject === "PHYSICS" ? "/physics" : "/chemistry"} className="font-medium text-[color:var(--accent)] hover:underline">
                {row.contestSet.subject === "MATH" ? "Matematică" : row.contestSet.subject === "PHYSICS" ? "Fizică" : "Chimie"} Seturi de concurs
              </Link>
              {" / "}
              <Link href={`/contest-sets/${row.contestSet.id}`} className="font-medium text-[color:var(--accent)] hover:underline">{row.contestSet.title}</Link>
              {" / "}Problema {orderNumber}
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-xl font-semibold text-zinc-900">Problema {orderNumber}: {row.title}</h1>
              <div className="flex shrink-0 items-stretch gap-2">
                {user && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-center flex flex-col items-center justify-center">
                    <div className={`text-base font-bold tabular-nums ${scoreColorClass(bestScore)}`}>{bestScore ?? 0}<span className="text-xs font-normal text-zinc-400">/100</span></div>
                    <div className="text-[10px] text-zinc-500">Best score</div>
                  </div>
                )}
                {bestScore != null && bestScore >= 70 && user && (
                  <ContestProblemStarRating
                    contestSetId={row.contestSet.id}
                    orderNumber={orderNumber}
                    initialRating={myRating?.ratingValue ?? null}
                  />
                )}
              </div>
            </div>
            {row.shortSummary ? <p className="text-sm text-zinc-700">{row.shortSummary}</p> : null}
            <div className="text-xs text-zinc-600">Scor maxim {row.maxScore}. Corectarea se face doar pentru această problemă internă.</div>
          </CardHeader>
          <CardContent className="grid gap-1">
            {row.contestSet.statementPdfUrl ? <a href={row.contestSet.statementPdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-[color:var(--accent)] hover:underline">Deschide PDF subiect</a> : null}
            {row.contestSet.rubricPdfUrl ? <a href={row.contestSet.rubricPdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-[color:var(--accent)] hover:underline">Deschide PDF barem</a> : null}
          </CardContent>
        </Card>
        <ProblemSubmissionSection
          contestSetProblemId={row.id}
          currentUsername={user?.username ?? null}
          initialMySubmissions={initialMySubmissions}
          initialAllSubmissions={initialAllSubmissions}
          initialViewerUnlockedPeerImages={viewerUnlockedPeerImages}
          loggedIn={Boolean(user)}
        />
      </div>
    </Container>
  );
}


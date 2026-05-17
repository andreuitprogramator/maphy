import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProblemSubmissionSection } from "@/components/problems/problem-submission-section";
import { PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE, serializePublicSubmissionsForClient, serializeSubmissionsForClient } from "@/lib/problems/submission-display";

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
      select: { id: true, status: true, aiScore: true, aiFeedback: true, aiBreakdown: true, imageQualityReason: true, reviewedAt: true, createdAt: true, imageUrl: true, user: { select: { username: true, avatarUrl: true } } },
    }),
    prisma.submission.findMany({
      where: { contestSetProblemId: row.id },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: { id: true, status: true, aiScore: true, aiFeedback: true, aiBreakdown: true, imageQualityReason: true, reviewedAt: true, createdAt: true, imageUrl: true, userId: true, user: { select: { username: true, avatarUrl: true } } },
    }),
  ]);

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
              <Link href={row.contestSet.subject === "MATH" ? "/math/contest-sets" : "/physics/contest-sets"} className="font-medium text-[color:var(--accent)] hover:underline">
                {row.contestSet.subject === "MATH" ? "Math" : "Physics"} Contest Sets
              </Link>
              {" / "}
              <Link href={`/contest-sets/${row.contestSet.id}`} className="font-medium text-[color:var(--accent)] hover:underline">{row.contestSet.title}</Link>
              {" / "}Problem {orderNumber}
            </div>
            <h1 className="text-xl font-semibold text-zinc-900">Problem {orderNumber}: {row.title}</h1>
            {row.shortSummary ? <p className="text-sm text-zinc-700">{row.shortSummary}</p> : null}
            <div className="text-xs text-zinc-600">Max score {row.maxScore}. Grading scope is this internal problem only.</div>
          </CardHeader>
          <CardContent className="grid gap-1">
            {row.contestSet.statementPdfUrl ? <a href={row.contestSet.statementPdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-[color:var(--accent)] hover:underline">Open statement PDF</a> : null}
            {row.contestSet.rubricPdfUrl ? <a href={row.contestSet.rubricPdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-[color:var(--accent)] hover:underline">Open rubric PDF</a> : null}
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


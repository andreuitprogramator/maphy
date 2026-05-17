import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProblemSubmissionSection } from "@/components/problems/problem-submission-section";
import { ProblemRatingPanel } from "@/components/problems/problem-rating-panel";
import { ProblemRichBody } from "@/components/problems/problem-rich-body";
import { ProblemCommentsSection } from "@/components/problems/problem-comments-section";
import {
  PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE,
  serializePublicSubmissionsForClient,
  serializeSubmissionsForClient,
} from "@/lib/problems/submission-display";
import { fetchProblemDetailStats } from "@/lib/problems/problem-list-data";
import { fetchProblemCommentsTree } from "@/lib/comments/thread-api";

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [problem, user] = await Promise.all([
    prisma.problem.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        statement: true,
        subject: true,
        difficulty: true,
        year: true,
        class: true,
        phase: true,
        status: true,
        createdById: true,
        author: { select: { username: true } },
        attachments: {
          orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
          select: { id: true, fileUrl: true, fileType: true, originalName: true, caption: true },
        },
      },
    }),
    getSessionUser(),
  ]);

  if (!problem) return notFound();

  if (problem.status === ProblemStatus.DRAFT) {
    if (!user || user.id !== problem.createdById) return notFound();
  }

  const viewerUnlockedPeerImages = user
    ? Boolean(
        await prisma.submission.findFirst({
          where: {
            userId: user.id,
            problemId: problem.id,
            status: "GRADED",
            aiScore: { gte: PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE },
          },
          select: { id: true },
        }),
      )
    : false;

  const [mySubmissions, allSubmissionsRows, leaderboard, detailStats] = await Promise.all([
    prisma.submission.findMany({
      where: { problemId: problem.id, ...(user ? { userId: user.id } : { userId: "__no_user__" }) },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        aiScore: true,
        aiFeedback: true,
        aiBreakdown: true,
        imageQualityReason: true,
        reviewedAt: true,
        createdAt: true,
        imageUrl: true,
        user: { select: { username: true, avatarUrl: true } },
      },
    }),
    prisma.submission.findMany({
      where: { problemId: problem.id },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        aiScore: true,
        aiFeedback: true,
        aiBreakdown: true,
        imageQualityReason: true,
        reviewedAt: true,
        createdAt: true,
        imageUrl: true,
        userId: true,
        user: { select: { username: true, avatarUrl: true } },
      },
    }),
    prisma.submission.findMany({
      where: { problemId: problem.id, status: "GRADED" },
      orderBy: [{ aiScore: "desc" }, { createdAt: "asc" }],
      take: 10,
      select: {
        id: true,
        aiScore: true,
        createdAt: true,
        user: { select: { username: true, avatarUrl: true } },
      },
    }),
    fetchProblemDetailStats(problem.id, user?.id ?? null),
  ]);

  const { tree: initialCommentTree, totalCount: commentThreadTotal } = await fetchProblemCommentsTree(
    problem.id,
    user?.id ?? null,
  );

  const initialMySubmissions = serializeSubmissionsForClient(mySubmissions);
  const initialAllSubmissions = serializePublicSubmissionsForClient(
    allSubmissionsRows.map((row) => {
      const isOwn = user?.id === row.userId;
      const canViewImage = isOwn || viewerUnlockedPeerImages;
      return {
        id: row.id,
        status: row.status,
        aiScore: row.aiScore,
        aiFeedback: row.aiFeedback,
        aiBreakdown: row.aiBreakdown,
        imageQualityReason: row.imageQualityReason,
        reviewedAt: row.reviewedAt,
        createdAt: row.createdAt,
        imageUrl: canViewImage ? row.imageUrl : null,
        canViewImage,
        user: row.user,
      };
    }),
  );

  return (
    <Container className="py-8">
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2 grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={problem.subject === "MATH" ? "/math" : "/physics"}
                  className="font-medium text-[color:var(--accent)] hover:underline"
                >
                  {problem.subject === "MATH" ? "Math" : "Physics"}
                </Link>
                <span className="text-zinc-400">/</span>
                <span
                  className={
                    problem.subject === "MATH"
                      ? "rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-900"
                      : "rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-900"
                  }
                >
                  {problem.subject === "MATH" ? "Math Problem" : "Physics Problem"}
                </span>
              </div>
              <div className="text-xs text-zinc-600">
                {problem.subject === "MATH" ? "Math" : "Physics"} · {problem.year} · Class {problem.class} ·{" "}
                {problem.phase.toLowerCase()} · Difficulty {problem.difficulty}/10
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
                {problem.title}
              </h1>
              {problem.status === ProblemStatus.DRAFT ? (
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-800">
                  <span>Draft — only visible to you until published.</span>
                  {user?.id === problem.createdById ? (
                    <Link
                      className="font-medium text-[color:var(--accent)] hover:underline"
                      href={`/teacher/problems/${problem.id}/edit`}
                    >
                      Continue editing
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {problem.author && problem.status === ProblemStatus.PUBLISHED ? (
                <div className="text-xs text-zinc-600">
                  Published by{" "}
                  <Link className="font-medium text-[color:var(--accent)] hover:underline" href={`/u/${problem.author.username}`}>
                    @{problem.author.username}
                  </Link>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-zinc-700">
                <span>
                  <span className="font-semibold text-zinc-900">{detailStats.submissionCount}</span> total
                  submissions
                </span>
                {user ? (
                  <span>
                    <span className="font-semibold text-zinc-900">{detailStats.mySubmissionCount}</span> yours
                  </span>
                ) : null}
                {detailStats.ratingCount > 0 && detailStats.ratingAvg != null ? (
                  <span>
                    ★ <span className="font-semibold tabular-nums">{detailStats.ratingAvg.toFixed(1)}</span> / 10
                    <span className="text-zinc-500"> ({detailStats.ratingCount})</span>
                  </span>
                ) : (
                  <span className="text-zinc-500">No ratings yet</span>
                )}
                <span>
                  <span className="font-semibold text-zinc-900">{detailStats.perfect100UserCount}</span> perfect
                  (100) solves
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ProblemRichBody content={problem.statement} />
              {problem.attachments.length > 0 ? (
                <div className="mt-6 grid gap-3">
                  <div className="text-sm font-medium text-zinc-900">Problem attachments</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {problem.attachments.map((a) =>
                      a.fileType === "IMAGE" ? (
                        <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="group rounded-xl border border-zinc-200 p-2 hover:border-zinc-300">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.fileUrl} alt={a.caption || a.originalName} className="aspect-video w-full rounded-lg object-cover" />
                          <div className="mt-2 text-xs text-zinc-600">{a.caption?.trim() || a.originalName}</div>
                        </a>
                      ) : (
                        <a
                          key={a.id}
                          href={a.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm font-medium text-[color:var(--accent)] hover:underline"
                        >
                          Open official PDF: {a.caption?.trim() || a.originalName}
                        </a>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {problem.status === ProblemStatus.PUBLISHED ? (
            <ProblemSubmissionSection
              problemId={problem.id}
              currentUsername={user?.username ?? null}
              initialMySubmissions={initialMySubmissions}
              initialAllSubmissions={initialAllSubmissions}
              initialViewerUnlockedPeerImages={viewerUnlockedPeerImages}
              loggedIn={Boolean(user)}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-zinc-900">Submissions</div>
                <div className="text-sm text-zinc-600">
                  This draft is not open for public submissions. Publish from the teacher editor when ready.
                </div>
              </CardHeader>
            </Card>
          )}
          {problem.status === ProblemStatus.PUBLISHED ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-zinc-900">Discussion</div>
              </CardHeader>
              <CardContent>
                <ProblemCommentsSection
                  problemId={problem.id}
                  currentUserId={user?.id ?? null}
                  currentUsername={user?.username ?? null}
                  initialComments={initialCommentTree}
                  initialTotalCount={commentThreadTotal}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-4 self-start">
          {problem.status === ProblemStatus.PUBLISHED ? (
          <ProblemRatingPanel
            problemId={problem.id}
            canRate={detailStats.canRate}
            initialMyRating={detailStats.myRatingStars}
            initialAvg={detailStats.ratingAvg}
            initialCount={detailStats.ratingCount}
          />
          ) : null}
          {problem.status === ProblemStatus.PUBLISHED ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-zinc-900">Leaderboard</div>
                <div className="text-sm text-zinc-600">Top 10 scores for this problem.</div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {leaderboard.length === 0 ? (
                  <div className="text-sm text-zinc-600">No entries yet.</div>
                ) : (
                  leaderboard.map((row, idx) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="text-zinc-500">{idx + 1}.</span>{" "}
                        <Link className="font-medium text-zinc-900 hover:underline" href={`/u/${row.user.username}`}>
                          @{row.user.username}
                        </Link>
                      </div>
                      <div className="text-sm font-semibold text-zinc-900">{row.aiScore ?? "—"}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </Container>
  );
}

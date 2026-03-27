import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SubmissionForm } from "@/components/problems/submission-form";

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
      select: { id: true, title: true, statement: true, subject: true, difficulty: true, year: true, class: true, phase: true },
    }),
    getSessionUser(),
  ]);

  if (!problem) return notFound();

  const [submissions, leaderboard] = await Promise.all([
    prisma.submission.findMany({
      where: { problemId: problem.id },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        score: true,
        createdAt: true,
        imageUrl: true,
        user: { select: { username: true, imageUrl: true } },
      },
    }),
    prisma.submission.findMany({
      where: { problemId: problem.id },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: 10,
      select: {
        id: true,
        score: true,
        createdAt: true,
        user: { select: { username: true, imageUrl: true } },
      },
    }),
  ]);

  return (
    <Container className="py-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-6">
          <Card>
            <CardHeader>
              <div className="text-xs text-zinc-600">
                {problem.subject === "MATH" ? "Math" : "Physics"} · {problem.year} · Class {problem.class} ·{" "}
                {problem.phase.toLowerCase()} · Difficulty {problem.difficulty}/10
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
                {problem.title}
              </h1>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap leading-relaxed text-zinc-800">
                {problem.statement}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-medium text-zinc-900">Submit your solution (photo)</div>
              {!user ? (
                <div className="text-sm text-zinc-600">
                  You need to <Link className="text-[color:var(--accent)] hover:underline" href="/login">log in</Link> to submit.
                </div>
              ) : (
                <div className="text-sm text-zinc-600">Submitting as @{user.username}.</div>
              )}
            </CardHeader>
            <CardContent>
              <SubmissionForm problemId={problem.id} disabled={!user} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-medium text-zinc-900">Recent submissions</div>
              <div className="text-sm text-zinc-600">Latest 20 uploads.</div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {submissions.length === 0 ? (
                <div className="text-sm text-zinc-600">No submissions yet. Be the first.</div>
              ) : (
                submissions.map((s) => (
                  <div key={s.id} className="grid gap-3 sm:grid-cols-[1fr_160px] sm:items-center">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-900">
                        <Link className="hover:underline" href={`/u/${s.user.username}`}>
                          @{s.user.username}
                        </Link>{" "}
                        <span className="text-zinc-500 font-normal">
                          · {new Date(s.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-700">
                        Score: <span className="font-semibold text-zinc-900">{s.score}</span>
                      </div>
                    </div>
                    <a href={s.imageUrl} className="block" target="_blank" rel="noreferrer">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                        <Image
                          src={s.imageUrl}
                          alt="Submission image"
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 160px"
                        />
                      </div>
                    </a>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
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
                  <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2">
                    <div className="min-w-0 text-sm">
                      <span className="text-zinc-500">{idx + 1}.</span>{" "}
                      <Link className="font-medium text-zinc-900 hover:underline" href={`/u/${row.user.username}`}>
                        @{row.user.username}
                      </Link>
                    </div>
                    <div className="text-sm font-semibold text-zinc-900">{row.score}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}


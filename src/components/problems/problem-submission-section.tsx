"use client";

import * as React from "react";
import Link from "next/link";
import {
  type ProblemSubmissionSerializable,
  type PublicSubmissionSerializable,
  PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE,
} from "@/lib/problems/submission-display";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SubmissionForm } from "@/components/problems/submission-form";
import { SubmissionCard } from "@/components/problems/submission-card";
import { PublicSubmissionListItem } from "@/components/problems/public-submission-list-item";

function toSerializableFromApi(row: {
  id: string;
  status: ProblemSubmissionSerializable["status"];
  aiScore: number | null;
  aiFeedback: string | null;
  aiBreakdown?: unknown;
  imageQualityReason: string | null;
  reviewedAt: string | Date | null;
  createdAt: string | Date;
  imageUrl: string;
  user: { username: string; avatarUrl?: string | null };
}): ProblemSubmissionSerializable {
  return {
    id: row.id,
    status: row.status,
    aiScore: row.aiScore,
    aiFeedback: row.aiFeedback,
    aiBreakdown: row.aiBreakdown ?? null,
    imageQualityReason: row.imageQualityReason,
    reviewedAt: row.reviewedAt
      ? typeof row.reviewedAt === "string"
        ? row.reviewedAt
        : row.reviewedAt.toISOString()
      : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
    imageUrl: row.imageUrl,
    user: { username: row.user.username, avatarUrl: row.user.avatarUrl ?? null },
  };
}

async function fetchSubmissionById(params: { problemId?: string; contestSetProblemId?: string; submissionId: string }): Promise<ProblemSubmissionSerializable | null> {
  const q = params.problemId
    ? `problemId=${encodeURIComponent(params.problemId)}`
    : `contestSetProblemId=${encodeURIComponent(params.contestSetProblemId ?? "")}`;
  const res = await fetch(`/api/submissions?${q}&scope=mine`);
  if (!res.ok) return null;
  const data = await res.json();
  const list = data.submissions as Array<Record<string, unknown>>;
  const found = list.find((s) => s.id === params.submissionId);
  return found ? toSerializableFromApi(found as Parameters<typeof toSerializableFromApi>[0]) : null;
}

export function ProblemSubmissionSection({
  problemId,
  contestSetProblemId,
  currentUsername,
  initialMySubmissions,
  initialAllSubmissions,
  initialViewerUnlockedPeerImages,
  loggedIn,
}: {
  problemId?: string;
  contestSetProblemId?: string;
  currentUsername: string | null;
  initialMySubmissions: ProblemSubmissionSerializable[];
  initialAllSubmissions: PublicSubmissionSerializable[];
  initialViewerUnlockedPeerImages: boolean;
  loggedIn: boolean;
}) {
  const [myItems, setMyItems] = React.useState<ProblemSubmissionSerializable[]>(initialMySubmissions);
  const [allItems, setAllItems] = React.useState<PublicSubmissionSerializable[]>(initialAllSubmissions);
  const [viewerUnlockedPeerImages, setViewerUnlockedPeerImages] = React.useState(initialViewerUnlockedPeerImages);
  const [tab, setTab] = React.useState<"mine" | "all">(loggedIn ? "mine" : "all");

  React.useEffect(() => {
    setMyItems(initialMySubmissions);
  }, [initialMySubmissions]);

  React.useEffect(() => {
    setAllItems(initialAllSubmissions);
  }, [initialAllSubmissions]);

  React.useEffect(() => {
    setViewerUnlockedPeerImages(initialViewerUnlockedPeerImages);
  }, [initialViewerUnlockedPeerImages]);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchAllSubmissions = React.useCallback(async () => {
    const q = problemId
      ? `problemId=${encodeURIComponent(problemId)}`
      : `contestSetProblemId=${encodeURIComponent(contestSetProblemId ?? "")}`;
    const res = await fetch(`/api/submissions?${q}&scope=all`);
    if (!res.ok) return;
    const data = await res.json();
    setAllItems((data.submissions ?? []) as PublicSubmissionSerializable[]);
    setViewerUnlockedPeerImages(Boolean(data.viewerUnlockedPeerImages));
  }, [problemId]);

  const pollUntilSettled = React.useCallback(
    async (submissionId: string) => {
      stopPoll();
      const started = Date.now();
      const maxMs = 60_000;
      pollRef.current = setInterval(async () => {
        if (Date.now() - started > maxMs) {
          stopPoll();
          return;
        }
        const updated = await fetchSubmissionById({ problemId, contestSetProblemId, submissionId });
        if (!updated) return;
        setMyItems((prev) => {
          const rest = prev.filter((s) => s.id !== submissionId && !s.id.startsWith("optimistic-"));
          const merged = [updated, ...rest];
          return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
        void fetchAllSubmissions();
        if (updated.status !== "PENDING") stopPoll();
      }, 1600);
    },
    [problemId, contestSetProblemId, stopPoll, fetchAllSubmissions],
  );

  React.useEffect(() => () => stopPoll(), [stopPoll]);

  const handleSubmitStart = React.useCallback(() => {
    if (!currentUsername) return;
    const optimistic: ProblemSubmissionSerializable = {
      id: `optimistic-${Date.now()}`,
      status: "PENDING",
      aiScore: null,
      aiFeedback: null,
      aiBreakdown: null,
      imageQualityReason: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      imageUrl: "",
      user: { username: currentUsername, avatarUrl: null },
    };
    setMyItems((prev) => [optimistic, ...prev.filter((s) => !s.id.startsWith("optimistic-"))]);
  }, [currentUsername]);

  const handleSubmitResult = React.useCallback(
    (submission: unknown) => {
      const row = submission as Parameters<typeof toSerializableFromApi>[0];
      const serialized = toSerializableFromApi(row);
      setMyItems((prev) => {
        const withoutOpt = prev.filter((s) => !s.id.startsWith("optimistic-"));
        const rest = withoutOpt.filter((s) => s.id !== serialized.id);
        return [serialized, ...rest].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
      void fetchAllSubmissions();
      if (serialized.status === "PENDING") void pollUntilSettled(serialized.id);
    },
    [pollUntilSettled, fetchAllSubmissions],
  );

  const handleSubmitError = React.useCallback(() => {
    setMyItems((prev) => prev.filter((s) => !s.id.startsWith("optimistic-")));
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="text-sm font-medium text-zinc-900">Submit your solution (photo)</div>
          {!loggedIn ? (
            <div className="text-sm text-zinc-600">
              You need to{" "}
              <Link className="text-[color:var(--accent)] hover:underline" href="/login">
                log in
              </Link>{" "}
              to submit.
            </div>
          ) : (
            <div className="text-sm text-zinc-600">Submitting as @{currentUsername}.</div>
          )}
        </CardHeader>
        <CardContent>
          <SubmissionForm
            problemId={problemId}
              contestSetProblemId={contestSetProblemId}
            disabled={!loggedIn}
            onSubmitStart={handleSubmitStart}
            onSubmitResult={handleSubmitResult}
            onSubmitError={handleSubmitError}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-medium text-zinc-900">Submissions</div>
          <div className="inline-flex rounded-xl border border-zinc-200 p-1">
            {loggedIn ? (
              <button
                type="button"
                onClick={() => setTab("mine")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "mine" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
              >
                My submissions
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "all" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
            >
              All submissions
            </button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {tab === "mine" ? (
            myItems.length === 0 ? (
              <div className="text-sm text-zinc-600">You have no submissions yet.</div>
            ) : (
              myItems.map((s) => <SubmissionCard key={s.id} row={s} />)
            )
          ) : allItems.length === 0 ? (
            <div className="text-sm text-zinc-600">No submissions yet. Be the first.</div>
          ) : (
            <>
              {!viewerUnlockedPeerImages ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Score at least {PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE}/100 on this problem to unlock other users&apos;
                  solution images.
                </div>
              ) : null}
              {allItems.map((s) => (
                <PublicSubmissionListItem key={s.id} row={s} />
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import type { ProblemSubmissionSerializable } from "@/lib/problems/submission-display";
import { GradedFeedbackReveal } from "@/components/problems/graded-feedback-reveal";
import { cn } from "@/lib/cn";

function StatusBadge({ status }: { status: ProblemSubmissionSerializable["status"] }) {
  const styles =
    status === "GRADED"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200"
      : status === "PENDING"
        ? "bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-200"
        : status === "BLURRY_REJECTED"
          ? "bg-zinc-100 text-zinc-800 border-zinc-300"
          : "bg-red-100 text-red-800 border-red-300 ring-1 ring-red-200";

  const label =
    status === "GRADED"
      ? "Graded"
      : status === "PENDING"
        ? "Waiting for AI"
        : status === "BLURRY_REJECTED"
          ? "Rejected (unreadable)"
          : "Failed";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold sm:text-[13px]",
        styles,
      )}
    >
      {label}
    </span>
  );
}

export function SubmissionCard({ row }: { row: ProblemSubmissionSerializable }) {
  const isOptimistic = row.id.startsWith("optimistic-");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <StatusBadge status={row.status} />
            {row.user.avatarUrl ? (
              <Link
                href={`/u/${row.user.username}`}
                className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50"
              >
                <Image src={row.user.avatarUrl} alt="" fill className="object-cover" sizes="28px" />
              </Link>
            ) : null}
            <span className="text-sm font-medium text-zinc-900">
              <Link className="hover:underline" href={`/u/${row.user.username}`}>
                @{row.user.username}
              </Link>
            </span>
            <span className="text-xs text-zinc-500 sm:text-sm">
              Submitted {new Date(row.createdAt).toLocaleString()}
            </span>
          </div>

          {row.status === "GRADED" ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-zinc-800">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>
                  Score: <strong className="text-lg tabular-nums text-zinc-900">{row.aiScore ?? "—"}</strong>
                </span>
                {row.aiScore === 100 ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-900">
                    Perfect
                  </span>
                ) : null}
              </span>
              {row.reviewedAt ? (
                <span className="text-zinc-600">Reviewed {new Date(row.reviewedAt).toLocaleString()}</span>
              ) : null}
            </div>
          ) : row.status === "PENDING" || isOptimistic ? (
            <p className="text-sm font-medium text-amber-800">Waiting for AI grading…</p>
          ) : row.status === "BLURRY_REJECTED" ? (
            <p className="text-sm text-zinc-800">
              <span className="font-medium text-zinc-900">Could not grade:</span>{" "}
              {row.imageQualityReason ?? "Image was not clear enough to read."}
            </p>
          ) : (
            <div className="text-sm text-red-800">
              <p>Grading failed. Try again with a clearer photo, or retry in a moment.</p>
              {row.aiFeedback ? (
                <p className="mt-1 text-xs text-red-900/90 whitespace-pre-wrap">{row.aiFeedback}</p>
              ) : null}
            </div>
          )}

          {row.status === "GRADED" ? (
            <GradedFeedbackReveal
              aiScore={row.aiScore}
              aiFeedback={row.aiFeedback}
              aiBreakdown={row.aiBreakdown}
              hint="Try to spot what you missed first. You can reveal the AI explanation whenever you want to review the solution."
            />
          ) : null}
        </div>

        <div className="w-full shrink-0 lg:w-[min(100%,200px)]">
          {isOptimistic ? (
            <div className="mx-auto aspect-[4/3] w-full max-w-[220px] animate-pulse rounded-xl bg-zinc-200 lg:mx-0" />
          ) : (
            <>
              <a href={row.imageUrl} className="block" target="_blank" rel="noreferrer">
                <div className="relative mx-auto aspect-[4/3] w-full max-w-[220px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 lg:mx-0 lg:max-w-none">
                  <Image
                    src={row.imageUrl}
                    alt="Submission"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 220px, 200px"
                  />
                </div>
              </a>
              <p className="mt-1 text-center text-xs text-zinc-500 lg:text-left">Tap to open full image</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

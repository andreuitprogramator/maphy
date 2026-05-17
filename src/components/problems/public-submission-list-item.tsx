"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { PublicSubmissionSerializable } from "@/lib/problems/submission-display";
import { parseFeedbackBreakdown } from "@/lib/problems/feedback-breakdown";

export function PublicSubmissionListItem({ row }: { row: PublicSubmissionSerializable }) {
  const [expanded, setExpanded] = React.useState(false);
  const breakdown = parseFeedbackBreakdown(row.aiBreakdown);
  const canExpand =
    Boolean(row.aiFeedback?.trim()) ||
    (breakdown?.rubric_breakdown?.length ?? 0) > 0 ||
    (breakdown?.detected_strengths?.length ?? 0) > 0 ||
    (breakdown?.detected_mistakes?.length ?? 0) > 0 ||
    Boolean(row.imageQualityReason?.trim());

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <Link className="font-medium text-zinc-900 hover:underline" href={`/u/${row.user.username}`}>
            @{row.user.username}
          </Link>
          <span className="ml-2 text-zinc-500">{new Date(row.createdAt).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {row.aiScore === 100 ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-violet-900">
              Perfect
            </span>
          ) : row.aiScore != null && row.aiScore >= 95 ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-900">
              95+
            </span>
          ) : null}
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 font-semibold text-zinc-700">
            {row.status}
          </span>
          <span className="font-semibold text-zinc-900">{row.aiScore ?? "—"}</span>
        </div>
      </div>
      {row.canViewImage && row.imageUrl ? (
        <a
          className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-[color:var(--accent)] hover:underline"
          href={row.imageUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span>Open solution image</span>
          <span className="relative h-8 w-10 overflow-hidden rounded border border-zinc-200 bg-zinc-50">
            <Image src={row.imageUrl} alt="" fill className="object-cover" sizes="40px" />
          </span>
        </a>
      ) : (
        <div className="mt-2 text-xs text-zinc-500">Solution image locked.</div>
      )}
      <div className="mt-2">
        {canExpand ? (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-[color:var(--accent)] hover:underline"
            >
              {expanded ? "Hide AI feedback" : "Show AI feedback"}
            </button>
            {expanded ? (
              <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700">
                {row.aiFeedback?.trim() ? (
                  <div>
                    <div className="font-semibold text-zinc-800">Written feedback</div>
                    <div className="mt-1 whitespace-pre-wrap">{row.aiFeedback}</div>
                  </div>
                ) : null}

                {breakdown?.rubric_breakdown && breakdown.rubric_breakdown.length > 0 ? (
                  <div>
                    <div className="font-semibold text-zinc-800">Rubric breakdown</div>
                    <ul className="mt-1 space-y-1">
                      {breakdown.rubric_breakdown.map((r, i) => (
                        <li key={`${row.id}-rb-${i}`} className="rounded border border-zinc-200 bg-white px-2 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{r.label}</span>
                            <span className="tabular-nums">
                              {r.points} / {r.maxPoints}
                            </span>
                          </div>
                          {r.notes ? <div className="mt-0.5 whitespace-pre-wrap text-zinc-600">{r.notes}</div> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {breakdown?.detected_strengths && breakdown.detected_strengths.length > 0 ? (
                  <div>
                    <div className="font-semibold text-zinc-800">Strengths</div>
                    <ul className="mt-1 list-disc pl-4">
                      {breakdown.detected_strengths.map((s, i) => (
                        <li key={`${row.id}-st-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {breakdown?.detected_mistakes && breakdown.detected_mistakes.length > 0 ? (
                  <div>
                    <div className="font-semibold text-zinc-800">Areas to improve</div>
                    <ul className="mt-1 list-disc pl-4">
                      {breakdown.detected_mistakes.map((s, i) => (
                        <li key={`${row.id}-ms-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {row.status === "BLURRY_REJECTED" && row.imageQualityReason ? (
                  <div>
                    <div className="font-semibold text-zinc-800">Rejected reason</div>
                    <div className="mt-1 whitespace-pre-wrap">{row.imageQualityReason}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-xs text-zinc-500">No AI feedback available.</div>
        )}
      </div>
    </div>
  );
}

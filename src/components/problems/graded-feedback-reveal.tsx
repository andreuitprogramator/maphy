"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  parseFeedbackBreakdown,
  type FeedbackBreakdownShape,
} from "@/lib/problems/feedback-breakdown";
import { LatexText } from "@/components/ui/latex-text";

function FeedbackBody({
  full,
  breakdown,
}: {
  full: string;
  breakdown: FeedbackBreakdownShape | null;
}) {
  return (
    <div className="space-y-4">
      {full ? (
        <div>
          <div className="text-xs font-semibold text-zinc-700">Feedback scris</div>
          <div className="mt-1.5 break-words text-sm leading-relaxed text-zinc-800">
            <LatexText>{full}</LatexText>
          </div>
        </div>
      ) : null}

      {breakdown?.detected_strengths && breakdown.detected_strengths.length > 0 ? (
        <div className="text-sm">
          <div className="text-xs font-semibold text-zinc-700">Puncte forte</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-700">
            {breakdown.detected_strengths.map((s, i) => (
              <li key={i} className="break-words">
                <LatexText>{s}</LatexText>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {breakdown?.detected_mistakes && breakdown.detected_mistakes.length > 0 ? (
        <div className="text-sm">
          <div className="text-xs font-semibold text-zinc-700">De îmbunătățit</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-700">
            {breakdown.detected_mistakes.map((s, i) => (
              <li key={i} className="break-words">
                <LatexText>{s}</LatexText>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {breakdown?.rubric_breakdown && breakdown.rubric_breakdown.length > 0 ? (
        <div className="text-sm">
          <div className="text-xs font-semibold text-zinc-700">Detalii barem</div>
          <ul className="mt-2 space-y-2">
            {breakdown.rubric_breakdown.map((row, i) => (
              <li key={i} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-900"><LatexText>{row.label}</LatexText></span>
                  <span className="text-xs tabular-nums text-zinc-600">
                    {row.points} / {row.maxPoints}
                  </span>
                </div>
                {row.notes ? (
                  <p className="mt-1 break-words text-xs text-zinc-600"><LatexText>{row.notes}</LatexText></p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  aiFeedback: string | null;
  aiBreakdown: unknown;
  /** When 100, feedback is shown immediately (no reveal step). */
  aiScore?: number | null;
  /** Hint under the toggle (learning-first UX). */
  hint?: string;
  className?: string;
};

export function GradedFeedbackReveal({ aiFeedback, aiBreakdown, aiScore, hint, className }: Props) {
  const [open, setOpen] = React.useState(false);

  const breakdown = parseFeedbackBreakdown(aiBreakdown);
  const full = (aiFeedback ?? "").trim();
  const hasBody =
    full.length > 0 ||
    (breakdown?.detected_strengths?.length ?? 0) > 0 ||
    (breakdown?.detected_mistakes?.length ?? 0) > 0 ||
    (breakdown?.rubric_breakdown?.length ?? 0) > 0;

  if (!hasBody) {
    return (
      <p className={cn("mt-2 text-sm text-zinc-600", className)}>
        Niciun feedback AI detaliat stocat pentru această rezolvare.
      </p>
    );
  }

  return (
    <div className={cn("mt-3 space-y-2", className)}>
      {hint ? <p className="text-xs leading-snug text-zinc-600 sm:text-sm">{hint}</p> : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-9 w-full border-zinc-300 text-zinc-800 shadow-sm sm:w-auto"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Ascunde explicația AI" : "Arată explicația AI"}
      </Button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 sm:mt-0 sm:p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Explicație AI</div>
            <div className="mt-3 border-t border-zinc-200 pt-3">
              <FeedbackBody full={full} breakdown={breakdown} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

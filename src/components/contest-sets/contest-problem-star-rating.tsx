"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  contestSetId: string;
  orderNumber: number;
  initialRating: number | null;
};

export function ContestProblemStarRating({ contestSetId, orderNumber, initialRating }: Props) {
  const [confirmed, setConfirmed] = React.useState<number | null>(initialRating);
  const [pending, setPending] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const display = hover ?? pending ?? confirmed;
  const isDirty = pending !== null && pending !== confirmed;

  async function handleConfirm() {
    if (saving || pending === null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contest-sets/${contestSetId}/problems/${orderNumber}/rating`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: pending }),
      });
      if (res.ok) {
        setConfirmed(pending);
        setPending(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-center flex flex-col justify-center">
      <div
        className="inline-flex gap-0.5"
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const v = i + 1;
          const active = display != null && display >= v;
          return (
            <button
              key={v}
              type="button"
              disabled={saving}
              className={cn(
                "text-2xl leading-none transition-colors px-0.5",
                active ? "text-amber-400" : "text-zinc-300",
                saving && "cursor-not-allowed opacity-60",
                !saving && "cursor-pointer",
              )}
              onMouseEnter={() => !saving && setHover(v)}
              onClick={() => !saving && setPending(v)}
              aria-label={`${v} stele`}
            >
              ★
            </button>
          );
        })}
      </div>
      <div className="mt-0.5 h-5 flex items-center justify-center">
        {isDirty ? (
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="rounded-md bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {saving ? "…" : "Confirmă"}
          </button>
        ) : confirmed !== null ? (
          <span className="text-[10px] text-emerald-600 font-medium">✓ Salvat</span>
        ) : (
          <span className="text-[10px] text-zinc-400">Evaluează</span>
        )}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StarRatingInput } from "@/components/problems/star-rating-input";
import { Button } from "@/components/ui/button";
import { RATING_MAX } from "@/lib/problems/rating-constants";

export function ProblemRatingPanel({
  problemId,
  canRate,
  initialMyRating,
  initialAvg,
  initialCount,
}: {
  problemId: string;
  canRate: boolean;
  initialMyRating: number | null;
  initialAvg: number | null;
  initialCount: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<number | null>(initialMyRating);
  const [avg, setAvg] = React.useState<number | null>(initialAvg);
  const [count, setCount] = React.useState(initialCount);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(initialMyRating);
  }, [initialMyRating]);

  React.useEffect(() => {
    setAvg(initialAvg);
    setCount(initialCount);
  }, [initialAvg, initialCount]);

  async function save() {
    if (draft == null) {
      setError("Selectează mai întâi o evaluare.");
      return;
    }
    setError(null);
    setOk(null);
    setPending(true);
    const res = await fetch(`/api/problems/${problemId}/rating`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: draft }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Nu s-a putut salva evaluarea");
      return;
    }
    setOk(initialMyRating == null ? "Salvat." : "Actualizat.");
    if (typeof data.ratingAvg === "number" || data.ratingAvg === null) setAvg(data.ratingAvg);
    if (typeof data.ratingCount === "number") setCount(data.ratingCount);
    router.refresh();
  }

  return (
    <div className="self-start grid w-full max-w-md gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-sm font-medium text-zinc-900">Evaluează problema</div>
        <div className="text-sm text-zinc-600">
          {avg != null ? (
            <>
              Medie <span className="font-semibold tabular-nums text-zinc-900">{avg.toFixed(1)}</span> /{" "}
              {RATING_MAX}
            </>
          ) : (
            <span>Fără evaluări</span>
          )}
          <span className="text-zinc-500"> · {count} {count === 1 ? "evaluare" : "evaluări"}</span>
        </div>
      </div>

      {!canRate ? (
        <p className="text-sm leading-snug text-zinc-600">
          Obține un scor perfect (100) la această problemă pentru a o evalua.
        </p>
      ) : (
        <div className="grid gap-2">
          <StarRatingInput
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setOk(null);
            }}
            disabled={pending}
          />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Button type="button" size="sm" disabled={pending || draft == null} onClick={save}>
              {pending ? "Se salvează…" : initialMyRating == null ? "Salvează evaluarea" : "Actualizează evaluarea"}
            </Button>
            {error ? <span className="text-xs text-red-600">{error}</span> : null}
            {ok ? <span className="text-xs text-emerald-700">{ok}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}

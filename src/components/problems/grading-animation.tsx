"use client";

import * as React from "react";
import { Spinner } from "@/components/ui/spinner";

export function GradingAnimation() {
  const [dotCount, setDotCount] = React.useState(1);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const dotId = setInterval(() => setDotCount((n) => (n % 3) + 1), 600);
    const tickId = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(dotId);
      clearInterval(tickId);
    };
  }, []);

  const dots = ".".repeat(dotCount);
  const showRefreshHint = elapsed >= 10;

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-amber-300 opacity-40 animate-ping" />
          <Spinner className="size-6 border-amber-500 border-t-transparent" />
        </div>
        <div>
          <div className="font-semibold text-amber-950">AI-ul corectează{dots}</div>
          <div className="text-xs text-amber-800/70">Durează de obicei 5–20 de secunde. Poți lăsa pagina deschisă.</div>
        </div>
      </div>

      {showRefreshHint && (
        <div className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900">
          Durează mai mult decât de obicei — un <button
            type="button"
            className="font-semibold underline underline-offset-2 hover:no-underline"
            onClick={() => window.location.reload()}
          >refresh al paginii</button> poate afișa rezultatul dacă a fost deja procesat.
        </div>
      )}

      <div className="grid gap-2">
        {[80, 60, 72].map((w, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-amber-200/60 animate-pulse"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}

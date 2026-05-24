"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const STAGES = [
  { value: "", label: "Toate etapele" },
  { value: "LOCAL", label: "Locală" },
  { value: "COUNTY", label: "Județeană" },
  { value: "NATIONAL", label: "Națională" },
];

export function ContestSetsFilterBar({
  years,
  classes,
  currentYear,
  currentStage,
  currentClass,
  currentSort,
}: {
  years: number[];
  classes: number[];
  currentYear: string;
  currentStage: string;
  currentClass: string;
  currentSort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const sel = "h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40";

  return (
    <div className="flex flex-wrap gap-2">
      <select className={sel} value={currentYear} onChange={(e) => update("year", e.target.value)}>
        <option value="">Toți anii</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>

      <select className={sel} value={currentStage} onChange={(e) => update("stage", e.target.value)}>
        {STAGES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {classes.length > 0 && (
        <select className={sel} value={currentClass} onChange={(e) => update("class", e.target.value)}>
          <option value="">Toate clasele</option>
          {classes.map((c) => (
            <option key={c} value={String(c)}>Clasa {c}</option>
          ))}
        </select>
      )}

      <select className={sel} value={currentSort} onChange={(e) => update("sort", e.target.value)}>
        <option value="">Sortare: recent</option>
        <option value="stars">Sortare: ★ stele</option>
      </select>
    </div>
  );
}

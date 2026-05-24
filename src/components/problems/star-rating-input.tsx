"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

import { RATING_MAX } from "@/lib/problems/rating-constants";

type Props = {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
  label?: string;
};

export function StarRatingInput({ value, onChange, disabled, label = "Evaluarea ta" }: Props) {
  const [hover, setHover] = React.useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div className="grid gap-1.5">
      {label ? <div className="text-xs font-medium text-zinc-700">{label}</div> : null}
      <div
        className="inline-flex flex-wrap gap-0.5"
        role="group"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: RATING_MAX }, (_, i) => {
          const v = i + 1;
          const active = display != null && display >= v;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              className={cn(
                "grid h-8 w-7 place-items-center rounded-md border border-zinc-200 bg-white text-sm leading-none transition-colors",
                active ? "text-amber-500" : "text-zinc-300",
                !disabled && "hover:bg-amber-50",
                disabled && "cursor-not-allowed opacity-60",
              )}
              onMouseEnter={() => !disabled && setHover(v)}
              onClick={() => !disabled && onChange(v)}
              aria-label={`Evaluează ${v} din ${RATING_MAX}`}
            >
              ★
            </button>
          );
        })}
      </div>
      {value != null ? (
        <div className="text-xs text-zinc-600">
          Salvat: <span className="font-semibold tabular-nums">{value}</span> / {RATING_MAX}
        </div>
      ) : null}
    </div>
  );
}

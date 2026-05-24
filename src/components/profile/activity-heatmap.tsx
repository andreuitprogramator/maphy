"use client";

import * as React from "react";

const MONTHS = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPTY_STYLE: React.CSSProperties = {
  backgroundColor: "var(--heatmap-empty-bg)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--heatmap-empty-border)",
};

function cellClass(count: number): string {
  if (count === 0) return "";
  if (count === 1) return "bg-emerald-200 dark:bg-emerald-900";
  if (count <= 3) return "bg-emerald-400 dark:bg-emerald-700";
  if (count <= 6) return "bg-emerald-500 dark:bg-emerald-500";
  return "bg-emerald-600 dark:bg-emerald-400";
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ActivityHeatmap({ activity }: { activity: Record<string, number> }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from the Sunday on or before 364 days ago
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  type DayEntry = { dateStr: string; count: number; monthStart: boolean; month: number };

  const days: DayEntry[] = [];
  const cur = new Date(startDate);
  while (cur <= today) {
    days.push({
      dateStr: toLocalDateStr(cur),
      count: activity[toLocalDateStr(cur)] ?? 0,
      monthStart: cur.getDate() === 1,
      month: cur.getMonth(),
    });
    cur.setDate(cur.getDate() + 1);
  }

  // Group into columns of 7 (weeks, Sun→Sat)
  const weeks: DayEntry[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Month label for each column (show when a new month starts in that week)
  const monthLabels: (string | null)[] = weeks.map((week) => {
    const found = week.find((d) => d.monthStart);
    return found ? MONTHS[found.month] : null;
  });

  const total = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* Month labels */}
          <div className="flex gap-1">
            {weeks.map((_, wi) => (
              <div key={wi} className="w-3 text-center text-[9px] leading-none text-zinc-400">
                {monthLabels[wi] ?? ""}
              </div>
            ))}
          </div>
          {/* Cells */}
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, di) => {
                  const day = week[di];
                  if (!day) return <div key={di} className="h-3 w-3" />;
                  return (
                    <div
                      key={di}
                      title={`${day.dateStr}: ${day.count} problem${day.count === 1 ? "ă" : "e"}`}
                      className={`h-3 w-3 rounded-[2px] cursor-default ${cellClass(day.count)}`}
                      style={day.count === 0 ? EMPTY_STYLE : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>{total} probleme noi rezolvate în ultimul an</span>
        <div className="flex items-center gap-1">
          <span>Mai puțin</span>
          {[0, 1, 2, 4, 7].map((n) => (
            <div key={n} className={`h-3 w-3 rounded-[2px] ${cellClass(n)}`} style={n === 0 ? EMPTY_STYLE : undefined} />
          ))}
          <span>Mai mult</span>
        </div>
      </div>
    </div>
  );
}

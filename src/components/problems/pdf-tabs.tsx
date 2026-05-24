"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Tab = { id: string; label: string; url: string };

export function PdfTabs({
  statementPdfUrl,
  rubricPdfUrl,
  leaderboardPdfUrl,
}: {
  statementPdfUrl?: string | null;
  rubricPdfUrl?: string | null;
  leaderboardPdfUrl?: string | null;
}) {
  const tabs: Tab[] = [
    statementPdfUrl ? { id: "subiect", label: "Subiect", url: statementPdfUrl } : null,
    rubricPdfUrl ? { id: "barem", label: "Barem", url: rubricPdfUrl } : null,
    leaderboardPdfUrl ? { id: "clasament", label: "Clasament", url: leaderboardPdfUrl } : null,
  ].filter(Boolean) as Tab[];

  const [active, setActive] = React.useState(tabs[0]?.id ?? "");

  if (tabs.length === 0) return null;

  const current = tabs.find((t) => t.id === active) ?? tabs[0]!;

  return (
    <div className="grid gap-0 overflow-hidden rounded-xl border border-zinc-200">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-200 bg-zinc-50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "relative flex-1 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none",
              active === tab.id
                ? "text-[color:var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[color:var(--accent)]"
                : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PDF viewer — all iframes stay mounted so they don't reload on tab switch */}
      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === active ? "block" : "hidden"}>
          <iframe
            src={tab.url}
            className="h-[600px] w-full"
            title={`PDF ${tab.label}`}
          />
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2">
            <a
              href={tab.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[color:var(--accent)] hover:underline"
            >
              Deschide {tab.label} în tab nou
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

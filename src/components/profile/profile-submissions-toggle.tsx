"use client";

import * as React from "react";
import { ProfileSubmissionsList, type ProfileSubmissionRow } from "./profile-submissions-list";

type Stats = { totalSubmissions: number; avgScore: number | null; latestActivityAt: string | null };

export function ProfileSubmissionsToggle({
  username,
  initialRows,
  initialStats,
}: {
  username: string;
  initialRows: ProfileSubmissionRow[];
  initialStats: Partial<Stats>;
}) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-[color:var(--accent)] hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
      >
        {show ? "Ascunde submisiile ↑" : "Vezi submisiile →"}
      </button>
      {show && <ProfileSubmissionsList username={username} initialRows={initialRows} initialStats={initialStats} />}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { GradedFeedbackReveal } from "@/components/problems/graded-feedback-reveal";
import { scoreColorClass } from "@/lib/ui/score-color";

export type ProfileSubmissionRow = {
  id: string;
  status: "PENDING" | "BLURRY_REJECTED" | "GRADED" | "FAILED";
  aiScore: number | null;
  aiFeedback: string | null;
  aiBreakdown: unknown;
  imageQualityReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  imageUrl: string;
  attempts?: number | null;
  problem: {
    id: string;
    title: string;
    subject?: "MATH" | "PHYSICS" | "CHEMISTRY";
    difficulty?: number;
    year?: number;
    classLevel?: number;
    phase?: string;
    contestSetId?: string;
    contestSetOrderNumber?: number;
  };
};

type ProfileSubmissionStats = {
  totalSubmissions: number;
  distinctProblems: number;
  perfectCount: number;
  avgScore: number | null;
  latestActivityAt: string | null;
};

type SortMode =
  | "newest"
  | "oldest"
  | "score_desc"
  | "score_asc"
  | "title_az"
  | "title_za"
  | "difficulty_desc"
  | "difficulty_asc";

type ScoreBucket = "any" | "100" | "95" | "85" | "75" | "below75";
type StatusFilter = "any" | "GRADED" | "PENDING" | "BLURRY_REJECTED" | "FAILED";
type SubjectFilter = "any" | "MATH" | "PHYSICS" | "CHEMISTRY";

function fmtAvg(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(1);
}

export function ProfileSubmissionsList({
  username,
  initialRows,
  initialStats,
}: {
  username: string;
  initialRows: ProfileSubmissionRow[];
  initialStats?: Partial<ProfileSubmissionStats>;
}) {
  const [tab, setTab] = React.useState<"all" | "best">("all");
  const [sort, setSort] = React.useState<SortMode>("newest");
  const [subject, setSubject] = React.useState<SubjectFilter>("any");
  const [status, setStatus] = React.useState<StatusFilter>("any");
  const [score, setScore] = React.useState<ScoreBucket>("any");

  const [rows, setRows] = React.useState<ProfileSubmissionRow[]>(initialRows);
  const [stats, setStats] = React.useState<ProfileSubmissionStats>({
    totalSubmissions: initialStats?.totalSubmissions ?? initialRows.length,
    distinctProblems: initialStats?.distinctProblems ?? 0,
    perfectCount: initialStats?.perfectCount ?? 0,
    avgScore: initialStats?.avgScore ?? null,
    latestActivityAt: initialStats?.latestActivityAt ?? null,
  });
  const [loading, setLoading] = React.useState(false);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("limit", "50");
    sp.set("sort", sort);
    sp.set("subject", subject);
    sp.set("status", status);
    sp.set("score", score);
    sp.set("best", tab === "best" ? "1" : "0");
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/submissions?${sp.toString()}`, {
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as {
      rows?: ProfileSubmissionRow[];
      stats?: ProfileSubmissionStats;
    };
    setLoading(false);
    if (!res.ok) return;
    setRows(data.rows ?? []);
    if (data.stats) setStats(data.stats);
  }, [username, sort, subject, status, score, tab]);

  React.useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-zinc-900">Rezolvări</div>
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "all" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
            >
              Toate
            </button>
            <button
              type="button"
              onClick={() => setTab("best")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "best" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
            >
              Cel mai bun per problemă
            </button>
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-zinc-600">
            <span className="font-medium text-zinc-700">Sortare</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
            >
              <option value="newest">Cele mai noi primul</option>
              <option value="oldest">Cele mai vechi primul</option>
              <option value="score_desc">Scor maxim primul</option>
              <option value="score_asc">Scor minim primul</option>
              <option value="title_az">Titlu problemă A-Z</option>
              <option value="title_za">Titlu problemă Z-A</option>
              <option value="difficulty_desc">Cel mai dificil primul</option>
              <option value="difficulty_asc">Cel mai ușor primul</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs text-zinc-600">
            <span className="font-medium text-zinc-700">Materie</span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as SubjectFilter)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
            >
              <option value="any">Toate</option>
              <option value="MATH">Matematică</option>
              <option value="PHYSICS">Fizică</option>
              <option value="CHEMISTRY">Chimie</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs text-zinc-600">
            <span className="font-medium text-zinc-700">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
            >
              <option value="any">Orice</option>
              <option value="GRADED">Corectat</option>
              <option value="PENDING">În așteptare</option>
              <option value="BLURRY_REJECTED">Respins</option>
              <option value="FAILED">Eșuat</option>
            </select>
          </label>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-zinc-600">
            <span className="font-medium text-zinc-700">Interval scor</span>
            <select
              value={score}
              onChange={(e) => setScore(e.target.value as ScoreBucket)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
            >
              <option value="any">Orice</option>
              <option value="100">100</option>
              <option value="95">95+</option>
              <option value="85">85+</option>
              <option value="75">75+</option>
              <option value="below75">Sub 75</option>
            </select>
          </label>
          <div className="sm:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="text-zinc-500">Total:</span>{" "}
                <span className="font-semibold text-zinc-900">{stats.totalSubmissions}</span>
              </span>
              <span>
                <span className="text-zinc-500">Distincte:</span>{" "}
                <span className="font-semibold text-zinc-900">{stats.distinctProblems || "-"}</span>
              </span>
              <span>
                <span className="text-zinc-500">Perfecte:</span>{" "}
                <span className="font-semibold text-zinc-900">{stats.perfectCount || 0}</span>
              </span>
              <span>
                <span className="text-zinc-500">Medie:</span>{" "}
                <span className="font-semibold text-zinc-900">{fmtAvg(stats.avgScore)}</span>
              </span>
              <span>
                <span className="text-zinc-500">Ultima activitate:</span>{" "}
                <span className="font-semibold text-zinc-900">
                  {stats.latestActivityAt ? new Date(stats.latestActivityAt).toLocaleDateString() : "-"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-zinc-500">Se încarcă...</div> : null}

      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-600">Nicio rezolvare nu corespunde acestor filtre.</div>
      ) : (
        <div className="grid gap-4">
          {rows.map((s) => (
            <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <Link
                    className="text-sm font-semibold text-zinc-900 hover:underline"
                    href={s.problem.contestSetId
                      ? `/contest-sets/${s.problem.contestSetId}/problems/${s.problem.contestSetOrderNumber}`
                      : `/problems/${s.problem.id}`}
                  >
                    {s.problem.title}
                  </Link>
                  <div className="text-xs text-zinc-600">
                    {new Date(s.createdAt).toLocaleString()}
                    {tab === "best" && s.attempts && s.attempts > 1 ? (
                      <span className="text-zinc-500"> · {s.attempts} încercări</span>
                    ) : null}
                    {s.problem.subject ? (
                      <span className="text-zinc-500">
                        {" "}
                        · {s.problem.subject === "MATH" ? "Matematică" : s.problem.subject === "PHYSICS" ? "Fizică" : "Chimie"}
                        {typeof s.problem.difficulty === "number" ? ` · dif. ${s.problem.difficulty}/10` : ""}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-zinc-600">
                    <span className="font-medium text-zinc-800">Status:</span>{" "}
                    {s.status === "GRADED"
                      ? "Corectat"
                      : s.status === "PENDING"
                        ? "Așteaptă corectare AI"
                        : s.status === "BLURRY_REJECTED"
                          ? "Respins (ilizibil)"
                          : "Eșuat"}
                    {s.reviewedAt ? (
                      <span className="text-zinc-500"> · revizuit {new Date(s.reviewedAt).toLocaleString()}</span>
                    ) : null}
                  </div>
                  {s.status === "GRADED" ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-800">
                      <span>
                        Scor: <strong className={`tabular-nums ${scoreColorClass(s.aiScore)}`}>{s.aiScore ?? "-"}</strong>
                      </span>
                      {s.aiScore === 100 ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
                          Perfect
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {s.status === "BLURRY_REJECTED" && s.imageQualityReason ? (
                    <p className="mt-2 text-sm text-zinc-700">{s.imageQualityReason}</p>
                  ) : null}
                  {s.status === "FAILED" ? (
                    <p className="mt-2 text-sm text-red-700">
                      Corectarea a eșuat.{s.aiFeedback ? ` ${s.aiFeedback}` : " Încearcă o imagine mai clară sau reîncarcă mai târziu."}
                    </p>
                  ) : null}
                  {s.status === "GRADED" ? (
                    <GradedFeedbackReveal
                      aiScore={s.aiScore}
                      aiFeedback={s.aiFeedback}
                      aiBreakdown={s.aiBreakdown}
                      hint="Arată explicația AI când ești pregătit să compari cu propria ta recenzie."
                    />
                  ) : null}
                </div>
                <div className="shrink-0 sm:text-right">
                  <a
                    href={s.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-[color:var(--accent)] hover:underline"
                  >
                    Deschide imaginea
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

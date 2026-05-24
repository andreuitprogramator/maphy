"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Problem = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  year: number;
  subject: string;
  phase: string;
  class: number;
  difficulty: number;
  updatedAt: string;
};

export default function TeacherProblemsListPage() {
  const router = useRouter();
  const [problems, setProblems] = React.useState<Problem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/teacher/problems")
      .then((r) => r.json())
      .then((d) => { setProblems(d.problems ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deleteProblem(id: string, title: string) {
    if (!confirm(`Ești sigur că vrei să ștergi "${title}"? Acțiunea este ireversibilă.`)) return;
    const res = await fetch(`/api/teacher/problems/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProblems((prev) => prev.filter((p) => p.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data?.error ?? "Ștergerea a eșuat");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Problemele mele</h2>
          <p className="text-sm text-zinc-600">Tot ce ai încărcat sau salvat ca ciornă.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/teacher/problems/new"
            className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-2)]"
          >
            Problemă nouă
          </Link>
          <Link
            href="/teacher/contest-sets/new"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Set de concurs nou
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-medium text-zinc-900">
            {loading ? "Se încarcă…" : `Toate (${problems.length})`}
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!loading && problems.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-600">Nicio problemă încă. Creează prima ta problemă.</div>
          ) : (
            problems.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">{p.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        p.status === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-zinc-200 text-zinc-800",
                      )}
                    >
                      {p.status === "PUBLISHED" ? "Publicat" : "Ciornă"}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600">
                    {p.subject === "MATH" ? "Matematică" : p.subject === "PHYSICS" ? "Fizică" : "Chimie"} · {p.year} · Clasa {p.class} · {p.phase.toLowerCase()} · dificultate {p.difficulty}/10 · Actualizat {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {p.status === "PUBLISHED" ? (
                    <Link
                      href={`/problems/${p.id}`}
                      className="text-xs font-medium text-[color:var(--accent)] hover:underline"
                    >
                      Vezi public
                    </Link>
                  ) : null}
                  <Link href={`/teacher/problems/${p.id}/edit`} className="text-xs font-medium text-zinc-700 hover:underline">
                    Editează
                  </Link>
                  <button
                    onClick={() => deleteProblem(p.id, p.title)}
                    className="text-xs font-medium text-red-600 hover:underline"
                    type="button"
                  >
                    Șterge
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

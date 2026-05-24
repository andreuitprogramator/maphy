import Link from "next/link";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function TeacherProblemsListPage() {
  const teacher = await requireTeacher();
  if (!teacher) redirect("/");

  const problems = await prisma.problem.findMany({
    where: { createdById: teacher.id },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      year: true,
      subject: true,
      phase: true,
      class: true,
      difficulty: true,
      updatedAt: true,
    },
  });

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
          <div className="text-sm font-medium text-zinc-900">Toate ({problems.length})</div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {problems.length === 0 ? (
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
                        p.status === ProblemStatus.PUBLISHED
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-zinc-200 text-zinc-800",
                      )}
                    >
                      {p.status === ProblemStatus.PUBLISHED ? "Publicat" : "Ciornă"}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600">
                    {p.subject === "MATH" ? "Matematică" : "Fizică"} · {p.year} · Clasa {p.class} · {p.phase.toLowerCase()}{" "}
                    · dificultate {p.difficulty}/10 · Actualizat {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.status === ProblemStatus.PUBLISHED ? (
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
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

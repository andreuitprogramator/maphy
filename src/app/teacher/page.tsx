import Link from "next/link";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function stageLabel(stage: string): string {
  switch (stage) {
    case "LOCAL": return "Locală";
    case "COUNTY": return "Județeană";
    case "NATIONAL": return "Națională";
    default: return stage;
  }
}

export default async function TeacherDashboardPage() {
  const teacher = await requireTeacher();
  if (!teacher) redirect("/");

  const contestSets = await prisma.contestSet.findMany({
    where: { createdById: teacher.id },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, title: true, status: true, year: true, subject: true, stage: true, totalProblemCount: true, updatedAt: true },
  });

  const draftContests = contestSets.filter((c) => c.status === ProblemStatus.DRAFT);
  const publishedContests = contestSets.filter((c) => c.status === ProblemStatus.PUBLISHED);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Panou profesor</h2>
          <p className="text-sm text-zinc-600">Gestionează concursurile tale și urmărește rezolvările elevilor.</p>
        </div>
        <Link
          href="/teacher/contest-sets/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[color:var(--accent-2)]"
        >
          + Concurs nou
        </Link>
      </div>

      {/* Contest sets */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Concursuri draft ({draftContests.length})</div>
            <div className="text-sm text-zinc-600">În lucru — nu sunt vizibile pentru elevi.</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {draftContests.length === 0 ? (
              <div className="text-sm text-zinc-500">Niciun draft.</div>
            ) : (
              draftContests.map((c) => (
                <Link
                  key={c.id}
                  href={`/teacher/contest-sets/${c.id}/edit`}
                  className="flex flex-col rounded-xl border border-zinc-200 px-3 py-2 hover:border-zinc-300"
                >
                  <span className="text-sm font-medium text-zinc-900">{c.title}</span>
                  <span className="text-xs text-zinc-500">
                    {c.subject === "MATH" ? "Matematică" : "Fizică"} · {stageLabel(c.stage)} · {c.year}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Concursuri publicate ({publishedContests.length})</div>
            <div className="text-sm text-zinc-600">Vizibile pe platformă — elevii pot trimite rezolvări.</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {publishedContests.length === 0 ? (
              <div className="text-sm text-zinc-500">Niciun concurs publicat încă.</div>
            ) : (
              publishedContests.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2">
                  <div className="flex flex-col min-w-0">
                    <Link href={`/contest-sets/${c.id}`} className="text-sm font-medium text-[color:var(--accent)] hover:underline truncate">
                      {c.title}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {c.subject === "MATH" ? "Matematică" : "Fizică"} · {stageLabel(c.stage)} · {c.year} · {c.totalProblemCount} probleme
                    </span>
                  </div>
                  <Link href={`/teacher/contest-sets/${c.id}/edit`} className="text-xs font-medium text-zinc-600 hover:text-zinc-900 shrink-0">
                    Editează
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

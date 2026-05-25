import Link from "next/link";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { ContestSetDeleteButton } from "@/components/teacher/contest-set-delete-button";

export const dynamic = "force-dynamic";

export default async function TeacherContestSetsListPage() {
  const teacher = await requireTeacher();
  if (!teacher) redirect("/");

  const isPip = teacher.username === "pip";
  const sets = await prisma.contestSet.findMany({
    where: isPip ? {} : { createdById: teacher.id },
    orderBy: [{ updatedAt: "desc" }],
    include: { _count: { select: { problems: true } } },
  });

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Seturile mele de concurs</h2>
          <p className="text-sm text-zinc-600">Subiecte de olimpiadă cu probleme interne.</p>
        </div>
        <Link href="/teacher/contest-sets/new" className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-2)]">
          Set de concurs nou
        </Link>
      </div>
      <Card>
        <CardHeader><div className="text-sm font-medium text-zinc-900">Toate ({sets.length})</div></CardHeader>
        <CardContent className="grid gap-2">
          {sets.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-600">Niciun set de concurs încă.</div>
          ) : sets.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{s.title}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">Set concurs</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", s.status === ProblemStatus.PUBLISHED ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-800")}>
                    {s.status === ProblemStatus.PUBLISHED ? "Publicat" : "Ciornă"}
                  </span>
                </div>
                <div className="text-xs text-zinc-600">
                  {s.subject === "MATH" ? "Matematică" : "Fizică"} - {s.competitionName} - {s.year} - Clasa {s.class} - {s.stage.toLowerCase()} - {s._count.problems} probleme
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/teacher/contest-sets/${s.id}/edit`} className="text-xs font-medium text-zinc-700 hover:underline">Editează</Link>
                {isPip && <ContestSetDeleteButton id={s.id} title={s.title} />}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


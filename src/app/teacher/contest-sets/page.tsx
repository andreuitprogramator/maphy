import Link from "next/link";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function TeacherContestSetsListPage() {
  const teacher = await requireTeacher();
  if (!teacher) redirect("/");

  const sets = await prisma.contestSet.findMany({
    where: { createdById: teacher.id },
    orderBy: [{ updatedAt: "desc" }],
    include: { _count: { select: { problems: true } } },
  });

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">My contest sets</h2>
          <p className="text-sm text-zinc-600">Olympiad sheets with internal problems.</p>
        </div>
        <Link href="/teacher/contest-sets/new" className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-2)]">
          New contest set
        </Link>
      </div>
      <Card>
        <CardHeader><div className="text-sm font-medium text-zinc-900">All ({sets.length})</div></CardHeader>
        <CardContent className="grid gap-2">
          {sets.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-600">No contest sets yet.</div>
          ) : sets.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{s.title}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">Contest Set</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", s.status === ProblemStatus.PUBLISHED ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-800")}>
                    {s.status === ProblemStatus.PUBLISHED ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="text-xs text-zinc-600">
                  {s.subject === "MATH" ? "Math" : "Physics"} - {s.competitionName} - {s.year} - Class {s.class} - {s.stage.toLowerCase()} - {s._count.problems} problems
                </div>
              </div>
              <Link href={`/teacher/contest-sets/${s.id}/edit`} className="text-xs font-medium text-zinc-700 hover:underline">Edit</Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


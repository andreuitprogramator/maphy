import Link from "next/link";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
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
      updatedAt: true,
      publishedAt: true,
    },
  });

  const drafts = problems.filter((p) => p.status === ProblemStatus.DRAFT);
  const published = problems.filter((p) => p.status === ProblemStatus.PUBLISHED);
  const contestSetCount = await prisma.contestSet.count({ where: { createdById: teacher.id } });

  return (
    <div className="grid gap-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Teacher dashboard</h2>
        <p className="text-sm text-zinc-600">
          Drafts stay private until you publish. Published problems appear on the public list and accept student
          submissions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Drafts ({drafts.length})</div>
            <div className="text-sm text-zinc-600">Work in progress — only you can open these.</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {drafts.length === 0 ? (
              <div className="text-sm text-zinc-500">No drafts yet.</div>
            ) : (
              drafts.map((p) => (
                <Link
                  key={p.id}
                  href={`/teacher/problems/${p.id}/edit`}
                  className="flex flex-col rounded-xl border border-zinc-200 px-3 py-2 hover:border-zinc-300"
                >
                  <span className="text-sm font-medium text-zinc-900">{p.title}</span>
                  <span className="text-xs text-zinc-600">
                    {p.subject === "MATH" ? "Math" : "Physics"} · {p.year} · class {p.class} · Updated{" "}
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Published ({published.length})</div>
            <div className="text-sm text-zinc-600">Live on the platform — linked from your profile.</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {published.length === 0 ? (
              <div className="text-sm text-zinc-500">Nothing published yet.</div>
            ) : (
              published.slice(0, 8).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2">
                  <Link href={`/problems/${p.id}`} className="text-sm font-medium text-[color:var(--accent)] hover:underline">
                    {p.title}
                  </Link>
                  <Link
                    href={`/teacher/problems/${p.id}/edit`}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Edit
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        You also have <span className="font-semibold text-zinc-900">{contestSetCount}</span> contest set
        {contestSetCount === 1 ? "" : "s"}.
        <Link href="/teacher/contest-sets" className="ml-2 font-medium text-[color:var(--accent)] hover:underline">
          Manage contest sets
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/teacher/problems/new"
          className="inline-flex w-fit rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-2)]"
        >
          Create new problem
        </Link>
        <Link
          href="/teacher/contest-sets/new"
          className="inline-flex w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Create contest set
        </Link>
      </div>
    </div>
  );
}

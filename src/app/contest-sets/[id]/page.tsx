import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProblemRichBody } from "@/components/problems/problem-rich-body";

export const dynamic = "force-dynamic";

export default async function ContestSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const set = await prisma.contestSet.findUnique({
    where: { id },
    include: {
      author: { select: { username: true } },
      problems: { orderBy: { orderNumber: "asc" } },
    },
  });
  if (!set || set.status !== "PUBLISHED") return notFound();

  return (
    <Container className="py-8">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="text-xs text-zinc-600">{set.subject === "MATH" ? "Math" : "Physics"} / Contest sets / {set.competitionName}</div>
            <h1 className="text-2xl font-semibold text-zinc-900">{set.title}</h1>
            <div className="text-xs text-zinc-600">{set.year} - Class {set.class} - {set.stage.toLowerCase()} - {set.totalProblemCount} problems</div>
            {set.author ? <div className="text-xs text-zinc-600">Published by <Link href={`/u/${set.author.username}`} className="font-medium text-[color:var(--accent)] hover:underline">@{set.author.username}</Link></div> : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            {set.summary ? <p className="text-sm text-zinc-700">{set.summary}</p> : null}
            {(set.statementDisplayMode === "TEXT_FIRST" || set.statementDisplayMode === "TEXT_ONLY") && set.statementText ? <ProblemRichBody content={set.statementText} /> : null}
            {set.statementDisplayMode !== "TEXT_ONLY" && set.statementPdfUrl ? <div className="rounded-xl border border-zinc-200 p-3"><div className="mb-2 text-sm font-medium text-zinc-900">Official statement PDF</div><iframe src={set.statementPdfUrl} className="h-[560px] w-full rounded-lg border border-zinc-200" title="Contest statement PDF" /></div> : null}
            {set.statementDisplayMode === "PDF_FIRST" && set.statementText ? <ProblemRichBody content={set.statementText} /> : null}
            {set.rubricPdfUrl ? <a className="text-sm font-medium text-[color:var(--accent)] hover:underline" href={set.rubricPdfUrl} target="_blank" rel="noreferrer">Open rubric PDF</a> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="text-sm font-medium text-zinc-900">Internal problems</div></CardHeader>
          <CardContent className="grid gap-2">
            {set.problems.map((p) => (
              <Link key={p.id} href={`/contest-sets/${set.id}/problems/${p.orderNumber}`} className="rounded-xl border border-zinc-200 px-3 py-3 hover:border-zinc-300">
                <div className="text-sm font-medium text-zinc-900">Problem {p.orderNumber}: {p.title}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}


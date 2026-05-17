import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PhysicsContestSetsPage() {
  const sets = await prisma.contestSet.findMany({
    where: { subject: "PHYSICS", status: "PUBLISHED" },
    orderBy: [{ year: "desc" }, { updatedAt: "desc" }],
    include: { _count: { select: { problems: true } } },
  });

  return (
    <Container className="py-8">
      <div className="grid gap-4">
        <Card className="border-sky-200 bg-sky-50/30">
          <CardHeader>
            <h2 className="text-2xl font-semibold tracking-tight">Physics Contest Sets</h2>
            <p className="text-sm text-zinc-600">Official olympiad sheets with internal problem grading.</p>
          </CardHeader>
        </Card>
        {sets.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-zinc-600">No contest sets published yet.</CardContent></Card> : sets.map((s) => (
          <Link key={s.id} href={`/contest-sets/${s.id}`}>
            <Card className="hover:border-zinc-300">
              <CardHeader>
                <div className="text-sm font-semibold text-zinc-900">{s.title}</div>
                <div className="text-xs text-zinc-600">{s.competitionName} - {s.year} - Class {s.class} - {s.stage.toLowerCase()} - {s._count.problems} problems</div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}


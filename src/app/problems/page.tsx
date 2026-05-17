import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  return (
    <Container className="py-8">
      <div className="grid gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Problems</h2>
          <p className="text-sm text-zinc-600">Choose your main section or browse everything in one place.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Link href="/math">
            <Card className="border-violet-200 bg-violet-50/30 hover:border-violet-300">
              <CardHeader>
                <div className="text-xl font-semibold tracking-tight text-zinc-900">Math</div>
                <div className="text-sm text-zinc-700">
                  Explore olympiad and competition problems in algebra, geometry, number theory, and combinatorics.
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-xs">
                {["Algebra", "Geometry", "Number Theory", "Combinatorics"].map((x) => (
                  <span key={x} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                    {x}
                  </span>
                ))}
              </CardContent>
            </Card>
          </Link>
          <Link href="/physics">
            <Card className="border-sky-200 bg-sky-50/30 hover:border-sky-300">
              <CardHeader>
                <div className="text-xl font-semibold tracking-tight text-zinc-900">Physics</div>
                <div className="text-sm text-zinc-700">
                  Train on mechanics, electricity, optics, thermodynamics, and olympiad-style physics challenges.
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-xs">
                {["Mechanics", "Electricity", "Optics", "Thermodynamics"].map((x) => (
                  <span key={x} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                    {x}
                  </span>
                ))}
              </CardContent>
            </Card>
          </Link>
        </div>
        <div>
          <Link className="text-sm font-medium text-[color:var(--accent)] hover:underline" href="/problems/all">
            View all problems in one unified list →
          </Link>
        </div>
      </div>
    </Container>
  );
}

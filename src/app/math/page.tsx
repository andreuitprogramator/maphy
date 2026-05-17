import type { ProblemsHubConfig } from "@/components/problems/problems-hub";
import { ProblemsHub } from "@/components/problems/problems-hub";
import Link from "next/link";

export const dynamic = "force-dynamic";

const config: ProblemsHubConfig = {
  title: "Math",
  subtitle:
    "Explore olympiad and competition problems in algebra, geometry, number theory, and combinatorics.",
  accentClass: "border-violet-200 bg-violet-50/30",
  chips: ["Algebra", "Geometry", "Number Theory", "Combinatorics"],
  emptyText: "No math problems found for these filters.",
  subjectPreset: "MATH",
  basePath: "/math",
};

export default async function MathPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="grid gap-3">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <div className="inline-flex rounded-xl border border-zinc-200 p-1">
          <Link href="/math" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
            Problems
          </Link>
          <Link href="/math/contest-sets" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700">
            Contest Sets
          </Link>
        </div>
      </div>
      <ProblemsHub searchParams={searchParams} config={config} />
    </div>
  );
}

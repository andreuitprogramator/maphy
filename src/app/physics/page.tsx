import type { ProblemsHubConfig } from "@/components/problems/problems-hub";
import { ProblemsHub } from "@/components/problems/problems-hub";
import Link from "next/link";

export const dynamic = "force-dynamic";

const config: ProblemsHubConfig = {
  title: "Physics",
  subtitle:
    "Train on mechanics, electricity, optics, thermodynamics, and olympiad-style physics challenges.",
  accentClass: "border-sky-200 bg-sky-50/30",
  chips: ["Mechanics", "Electricity", "Optics", "Thermodynamics"],
  emptyText: "No physics problems found for these filters.",
  subjectPreset: "PHYSICS",
  basePath: "/physics",
};

export default async function PhysicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="grid gap-3">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <div className="inline-flex rounded-xl border border-zinc-200 p-1">
          <Link href="/physics" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
            Problems
          </Link>
          <Link href="/physics/contest-sets" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700">
            Contest Sets
          </Link>
        </div>
      </div>
      <ProblemsHub searchParams={searchParams} config={config} />
    </div>
  );
}

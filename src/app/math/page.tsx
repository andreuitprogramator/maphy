import { ContestSetsHub } from "@/components/contest-sets/contest-sets-hub";

export const dynamic = "force-dynamic";

export default async function MathPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ContestSetsHub
      config={{
        subject: "MATH",
        title: "Matematică — Subiecte de olimpiadă",
        subtitle: "Subiecte oficiale de olimpiadă la matematică, cu corectare automată prin AI.",
        accentClass: "border-violet-200 bg-violet-50/30",
      }}
      searchParams={await searchParams}
    />
  );
}

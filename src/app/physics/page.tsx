import { ContestSetsHub } from "@/components/contest-sets/contest-sets-hub";

export const dynamic = "force-dynamic";

export default async function PhysicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ContestSetsHub
      config={{
        subject: "PHYSICS",
        title: "Fizică — Subiecte de olimpiadă",
        subtitle: "Subiecte oficiale de olimpiadă la fizică, cu corectare automată prin AI.",
        accentClass: "border-sky-200 bg-sky-50/30",
      }}
      searchParams={await searchParams}
    />
  );
}

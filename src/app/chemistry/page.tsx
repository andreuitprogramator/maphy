import { ContestSetsHub } from "@/components/contest-sets/contest-sets-hub";

export const dynamic = "force-dynamic";

export default async function ChemistryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ContestSetsHub
      config={{
        subject: "CHEMISTRY",
        title: "Chimie — Subiecte de olimpiadă",
        subtitle: "Subiecte oficiale de olimpiadă la chimie, cu corectare automată prin AI.",
        accentClass: "border-green-200 bg-green-50/30",
      }}
      searchParams={await searchParams}
    />
  );
}

import type { ProblemsHubConfig } from "@/components/problems/problems-hub";
import { ProblemsHub } from "@/components/problems/problems-hub";

export const dynamic = "force-dynamic";

const config: ProblemsHubConfig = {
  title: "Problems",
  subtitle: "Browse all published competition problems across math and physics.",
  accentClass: "border-zinc-200",
  chips: ["Math", "Physics", "Rated", "Community submissions"],
  emptyText: "No problems match these filters yet.",
  basePath: "/problems/all",
};

export default async function AllProblemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProblemsHub searchParams={searchParams} config={config} />;
}

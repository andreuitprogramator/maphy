export function scoreColorClass(score: number | null): string {
  if (score === null) return "text-zinc-400";
  if (score === 100) return "text-emerald-500";
  if (score >= 70) return "text-amber-500";
  if (score >= 20) return "text-orange-500";
  return "text-red-500";
}

import { jsonOk } from "@/lib/api/response";
import { getGlobalLeaderboard, parseGlobalLeaderboardMode } from "@/lib/leaderboards/global";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = parseGlobalLeaderboardMode(url.searchParams.get("mode"));
  const { leaderboard } = await getGlobalLeaderboard(mode);
  return jsonOk({ mode, leaderboard });
}

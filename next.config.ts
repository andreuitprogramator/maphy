import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid bundling Prisma: Turbopack/Webpack can embed a stale generated client (missing models like problemRating).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;

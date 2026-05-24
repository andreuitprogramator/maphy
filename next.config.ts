import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid bundling Prisma: Turbopack/Webpack can embed a stale generated client (missing models like problemRating).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  allowedDevOrigins: ["192.168.1.141"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;

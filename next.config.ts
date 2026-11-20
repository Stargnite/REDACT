import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // REDACT has no server. The whole app is a static export served by Firebase
  // Hosting, which is what keeps the project on the no-cost Spark plan.
  output: "export",
  // Firebase Hosting serves /how-it-works/ from /how-it-works/index.html.
  // Without this, every route needs a rewrite rule.
  trailingSlash: true,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["vm2", "playwright", "playwright-core"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;

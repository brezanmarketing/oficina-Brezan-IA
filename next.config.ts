import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["vm2", "playwright", "playwright-core"],
};

export default nextConfig;

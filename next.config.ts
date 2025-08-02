// next.config.ts (FINAL, SIMPLIFIED VERSION)

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No special webpack configuration is needed for modern Next.js workers.
  // We are removing the custom 'worker-loader' rule.
};

export default nextConfig;
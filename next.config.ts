import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep production builds stable in constrained CI/container runners.
    // This only affects build-time worker parallelism, not runtime performance.
    cpus: 4,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    if (process.env.ELKLART_DEMO_ENABLED !== 'true') return [];
    return [{
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    }];
  },
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'mina-sidor-demo[.]gridex[.]se' }],
        destination: '/mina-sidor',
        permanent: false,
      },
      {
        source: "/teckna/tack",
        destination: "/teckna-avtal/tack",
        permanent: true,
      },
    ];
  },
  experimental: {
    // Keep production builds stable in constrained CI/container runners.
    // This only affects build-time worker parallelism, not runtime performance.
    cpus: 4,
  },
};

export default nextConfig;

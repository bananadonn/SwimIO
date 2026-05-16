import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: "script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src blob:;" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be reached via localhost, 127.0.0.1, and the
  // box's LAN address without blocking the HMR / RSC bundle. Without this,
  // Next.js 16 silently refuses HMR requests from any host other than the
  // one the user-agent navigated to first, which leaves the page hydrated
  // but with no client-side event handlers — visually rendered but
  // unclickable.
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.local"],

  // Hide the framework fingerprint from response headers.
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Security headers for all routes
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Block cross-origin requests to API routes
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;

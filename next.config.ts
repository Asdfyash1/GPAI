import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be reached via localhost, 127.0.0.1, and the
  // box's LAN address without blocking the HMR / RSC bundle. Without this,
  // Next.js 16 silently refuses HMR requests from any host other than the
  // one the user-agent navigated to first, which leaves the page hydrated
  // but with no client-side event handlers — visually rendered but
  // unclickable.
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.local"],
};

export default nextConfig;

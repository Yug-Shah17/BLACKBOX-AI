import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL?.trim() || "http://127.0.0.1:8000").replace(/\/+$/, "");
    return [{ source: "/api/blackbox/:path*", destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;

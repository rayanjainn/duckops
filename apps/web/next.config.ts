import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@duckops/shared-types"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      // Allow ngrok domains for any avatars/images served through tunnels
      {
        protocol: "https",
        hostname: "*.ngrok-free.app",
      },
    ],
  },

  // Expose env vars to the client bundle at build time.
  // On Vercel, set these in: Project → Settings → Environment Variables
  // On local dev they come from apps/web/.env.local
  env: {
    NEXT_PUBLIC_API_URL:      process.env.NEXT_PUBLIC_API_URL      ?? "http://localhost:4002",
    NEXT_PUBLIC_CATALOG_URL:  process.env.NEXT_PUBLIC_CATALOG_URL  ?? "http://localhost:4001",
    NEXT_PUBLIC_SOCKET_URL:   process.env.NEXT_PUBLIC_SOCKET_URL   ?? "http://localhost:4002",
    NEXT_PUBLIC_PIPELINE_URL: process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:4003",
    NEXT_PUBLIC_HEALTH_URL:   process.env.NEXT_PUBLIC_HEALTH_URL   ?? "http://localhost:4004",
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@duckops/shared-types"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;

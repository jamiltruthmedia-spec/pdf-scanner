import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase API body size limit for large PDF uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;

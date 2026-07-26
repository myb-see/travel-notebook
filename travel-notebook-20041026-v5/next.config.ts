import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.dev.coze.site", "travel.20041026.xyz"],
  poweredByHeader: false,
};

export default nextConfig;

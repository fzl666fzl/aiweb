import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/study/extract": ["./node_modules/@napi-rs/canvas/**/*", "./node_modules/@napi-rs/canvas-*/*"],
  },
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;

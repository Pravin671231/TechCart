import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace-bundles only the deps this app actually needs into
  // .next/standalone — required for a minimal Docker image
  // (docker/Dockerfile.buyer-app); harmless for the non-Docker
  // dev/build/start workflow, which ignores it.
  output: "standalone",
};

export default nextConfig;

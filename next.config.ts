import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ensure docs/curriculum-standards.md (read by lib/curriculum.ts at server
  // module load) is included in the production output trace.
  outputFileTracingIncludes: {
    "/**/*": ["./docs/curriculum-standards.md"]
  }
};

export default nextConfig;

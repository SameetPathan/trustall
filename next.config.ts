import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These run only on the server and should not be bundled.
  serverExternalPackages: ["@paypal/agent-toolkit", "pg", "@anthropic-ai/sdk"],
};

export default nextConfig;

import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;

initOpenNextCloudflareForDev();

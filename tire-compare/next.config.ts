import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid wrong workspace root when a parent directory has its own lockfile
  outputFileTracingRoot: appDir,
};

export default nextConfig;

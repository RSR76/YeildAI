import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root also has a package-lock.json, which makes Next.js infer the
  // wrong workspace root and breaks native module resolution (Tailwind oxide).
  // Pin the root to this directory so local and Vercel builds behave the same.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

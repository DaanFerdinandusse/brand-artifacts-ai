import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["esbuild", "lightningcss", "@tailwindcss/postcss"],
  turbopack: {
    rules: {
      "*.md": {
        loaders: [path.resolve(process.cwd(), "lib/loaders/ignore-md-loader.js")],
      },
    },
  },
};

export default nextConfig;

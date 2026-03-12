/**
 * Build script for the Acontext Claude Code plugin.
 * Uses esbuild to bundle TypeScript source into single CJS files.
 */

import * as esbuild from "esbuild";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(rootDir, "plugin", "scripts");

const commonOptions: esbuild.BuildOptions = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  sourcemap: false,
  minify: false,
  // Keep readable for debugging
  keepNames: true,
};

async function build() {
  console.log("Building Acontext Claude Code plugin...");

  // Bundle mcp-server
  await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(rootDir, "src", "mcp-server.ts")],
    outdir: outDir,
    banner: {
      js: "#!/usr/bin/env node",
    },
  });
  console.log("  ✓ plugin/scripts/mcp-server.cjs");

  // Bundle hook-handler
  await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(rootDir, "src", "hook-handler.ts")],
    outdir: outDir,
    banner: {
      js: "#!/usr/bin/env node",
    },
  });
  console.log("  ✓ plugin/scripts/hook-handler.cjs");

  console.log("Build complete.");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});

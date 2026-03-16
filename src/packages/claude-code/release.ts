/**
 * Release script — bumps version in all plugin manifests, then rebuilds.
 *
 * Usage:  npm run release -- 0.2.0
 *    or:  npx tsx release.ts 0.2.0
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const VERSION_FILES = [
  // package.json  (this package)
  path.join(rootDir, "package.json"),
  // plugin.json   (plugin manifest)
  path.join(rootDir, "plugin", ".claude-plugin", "plugin.json"),
  // marketplace.json (marketplace registry)
  path.join(rootDir, "..", "..", "..", ".claude-plugin", "marketplace.json"),
];

function updateVersion(filePath: string, version: string) {
  const rel = path.relative(path.join(rootDir, "..","..",".."), filePath);
  const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // marketplace.json has plugins[].version
  if (Array.isArray(content.plugins)) {
    for (const plugin of content.plugins) {
      if (plugin.name === "acontext") {
        plugin.version = version;
      }
    }
  } else {
    content.version = version;
  }

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n");
  console.log(`  ✓ ${rel}  →  ${version}`);
}

async function main() {
  const version = process.argv[2];

  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    console.error("Usage: npm run release -- <semver>");
    console.error("  e.g. npm run release -- 0.2.0");
    process.exit(1);
  }

  console.log(`\nBumping version to ${version} ...\n`);

  for (const file of VERSION_FILES) {
    updateVersion(file, version);
  }

  console.log("\nRebuilding plugin ...\n");
  // Safe: no user input in command string
  execSync("npm run build", { cwd: rootDir, stdio: "inherit" });

  console.log(`\nDone! Released v${version}\n`);
}

main().catch((err) => {
  console.error("Release failed:", err);
  process.exit(1);
});

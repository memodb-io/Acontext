/**
 * Post-build script to patch OpenNext handler.mjs for Cloudflare Workers.
 * 
 * Turbopack generates hashed external module names (e.g. "shiki-43d062b67f27bbdc/core")
 * that can't be resolved by `import()` in Workers. This script:
 * 1. Replaces hashed names with real package names
 * 2. Patches `externalImport` to pre-resolve shiki modules via static imports
 */
import { readFileSync, writeFileSync } from 'node:fs';

const HANDLER_PATH = '.open-next/server-functions/default/handler.mjs';

let handler = readFileSync(HANDLER_PATH, 'utf8');
const originalSize = handler.length;

// Step 1: Replace Turbopack hashed module names with real package names
const replaced = new Set();
handler = handler.replace(
  /(?<=")((?:@[a-z0-9_.-]+\/)?[a-z][a-z0-9_.-]*)-[a-f0-9]{16}(\/[a-z0-9_/.-]*)?(?=")/g,
  (match, pkg, subpath) => {
    const real = pkg + (subpath || '');
    replaced.add(`${match} -> ${real}`);
    return real;
  }
);

// Step 2: Add static imports at top of file and patch externalImport
// to resolve known modules from these static imports
const staticImports = `
import * as __shiki from "shiki";
import * as __shiki_core from "shiki/core";
import * as __shiki_engine_js from "shiki/engine/javascript";
import * as __shiki_wasm from "shiki/wasm";
const __EXTERNAL_MODULES = {
  "shiki": __shiki,
  "shiki/core": __shiki_core,
  "shiki/engine/javascript": __shiki_engine_js,
  "shiki/wasm": __shiki_wasm,
};
`;

handler = staticImports + handler;

// Patch externalImport to check __EXTERNAL_MODULES first
handler = handler.replace(
  /async function externalImport\(id\)\{let raw;try\{/g,
  'async function externalImport(id){let raw;try{if(typeof __EXTERNAL_MODULES!=="undefined"&&id in __EXTERNAL_MODULES){raw=__EXTERNAL_MODULES[id]}else '
);

writeFileSync(HANDLER_PATH, handler);

console.log(`Patched ${HANDLER_PATH} (${originalSize} -> ${handler.length} bytes)`);
console.log('Replaced hashed refs:');
for (const r of replaced) {
  console.log(`  ${r}`);
}
console.log('Added static imports for: shiki, shiki/core, shiki/engine/javascript, shiki/wasm');

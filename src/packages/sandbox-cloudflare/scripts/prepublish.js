#!/usr/bin/env node

/**
 * Prepublish script to copy template files from source directory
 * This ensures the published package includes the latest template files
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find repository root
function findRepoRoot(startDir) {
	let current = resolve(startDir);
	const root = resolve('/');
	
	while (current !== root) {
		const gitDir = join(current, '.git');
		const srcServerSandbox = join(current, 'src', 'server', 'sandbox', 'cloudflare');
		if (existsSync(gitDir) && existsSync(srcServerSandbox)) {
			return srcServerSandbox;
		}
		current = dirname(current);
	}
	return null;
}

const sourceDir = findRepoRoot(__dirname);
const templateDir = join(__dirname, '..', 'template');

if (!sourceDir) {
	console.error('❌ Error: Could not find source directory (src/server/sandbox/cloudflare)');
	console.error('Make sure you are running this script from the repository root.');
	process.exit(1);
}

if (!existsSync(sourceDir)) {
	console.error(`❌ Error: Source directory not found: ${sourceDir}`);
	process.exit(1);
}

console.log('📦 Preparing template files for publishing...');
console.log(`   Source: ${sourceDir}`);
console.log(`   Target: ${templateDir}`);

// Remove existing template directory
if (existsSync(templateDir)) {
	console.log('   Removing existing template directory...');
	rmSync(templateDir, { recursive: true, force: true });
}

// Create template directory
mkdirSync(templateDir, { recursive: true });

// Function to copy directory recursively
function copyRecursive(src, dest) {
	const entries = readdirSync(src, { withFileTypes: true });
	mkdirSync(dest, { recursive: true });

	for (const entry of entries) {
		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isDirectory()) {
			// Skip node_modules and other ignored directories
			if (entry.name === 'node_modules' || entry.name === '.wrangler' || entry.name === '.git' || entry.name === '.vscode') {
				continue;
			}
			copyRecursive(srcPath, destPath);
		} else {
			// Skip lock files that will be regenerated
			if (entry.name === 'pnpm-lock.yaml' || entry.name === 'package-lock.json' || entry.name === 'yarn.lock' || entry.name === 'bun.lockb') {
				continue;
			}

			try {
				// Try to read as text file
				let content = readFileSync(srcPath, 'utf-8');
				
				// Replace specific values with template variables
				// Only replace in package.json and wrangler.jsonc
				if (entry.name === 'package.json') {
					// Replace package name with template variable
					content = content.replace(/"name":\s*"cloudflare-sandbox-worker"/g, '"name": "{{project-name}}"');
				} else if (entry.name === 'wrangler.jsonc') {
					// Replace wrangler name with template variable
					content = content.replace(/"name":\s*"acontext-sandbox-worker"/g, '"name": "{{project-name}}"');
				}
				
				writeFileSync(destPath, content, 'utf-8');
			} catch (e) {
				// If file is binary or can't be read as text, copy as-is
				copyFileSync(srcPath, destPath);
			}
		}
	}
}

try {
	copyRecursive(sourceDir, templateDir);
	console.log('✅ Template files prepared successfully!');
} catch (error) {
	console.error('❌ Error preparing template files:', error.message);
	process.exit(1);
}

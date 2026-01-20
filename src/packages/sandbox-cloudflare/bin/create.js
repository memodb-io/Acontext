#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get project name from command line arguments
const args = process.argv.slice(2);
const projectNameIndex = args.findIndex(arg => !arg.startsWith('-'));
const projectName = projectNameIndex !== -1 ? args[projectNameIndex] : null;
const skipInstall = args.includes('--skip-install') || args.includes('--no-install');
const yes = args.includes('--yes') || args.includes('-y');

// Find repository root by looking for .git directory or package.json at root
function findRepoRoot(startDir) {
	let current = resolve(startDir);
	const root = resolve('/');
	
	while (current !== root) {
		const gitDir = join(current, '.git');
		const rootPackageJson = join(current, 'package.json');
		// Check if this looks like the repo root (has .git or root package.json)
		if (existsSync(gitDir) || existsSync(rootPackageJson)) {
			// Verify it's the Acontext repo by checking for src directory structure
			const srcServerSandbox = join(current, 'src', 'server', 'sandbox', 'cloudflare');
			if (existsSync(srcServerSandbox)) {
				return srcServerSandbox;
			}
		}
		current = dirname(current);
	}
	return null;
}

// Try to use source directory first (for development), fallback to template (for published package)
const sourceTemplateDir = findRepoRoot(__dirname);
const templateDir = sourceTemplateDir || join(__dirname, '..', 'template');

function validateProjectName(name) {
	if (!name) {
		console.error('❌ Error: Project name is required');
		console.log('\nUsage:');
		console.log('  npx @acontext/sandbox-cloudflare@latest <project-name> [options]');
		console.log('  # or: npm create @acontext/sandbox-cloudflare@latest <project-name> [options]');
		console.log('\nOptions:');
		console.log('  --yes, -y           Skip prompts and use defaults');
		console.log('  --skip-install      Skip installing dependencies');
		console.log('  --no-install        Skip installing dependencies');
		process.exit(1);
	}

	// Validate project name format
	if (!/^[a-z0-9-_]+$/i.test(name)) {
		console.error('❌ Error: Project name can only contain letters, numbers, hyphens, and underscores');
		process.exit(1);
	}

	return name;
}

function copyTemplate(srcDir, destDir, projectName) {
	if (!existsSync(srcDir)) {
		console.error(`❌ Error: Template directory not found: ${srcDir}`);
		if (sourceTemplateDir) {
			console.error('Source template directory not found. Please ensure src/server/sandbox/cloudflare exists.');
		} else {
			console.error('This package may be corrupted. Please try reinstalling.');
		}
		process.exit(1);
	}

	console.log('📦 Copying template files...');

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
					// Try to read as text file and replace template variables
					let content = readFileSync(srcPath, 'utf-8');

					// Replace template variables
					content = content.replace(/\{\{project_name\}\}/g, projectName);
					content = content.replace(/\{\{project-name\}\}/g, projectName.replace(/_/g, '-'));

					writeFileSync(destPath, content, 'utf-8');
				} catch (e) {
					// If file is binary or can't be read as text, copy as-is
					copyFileSync(srcPath, destPath);
				}
			}
		}
	}

	// Copy template files recursively
	try {
		copyRecursive(srcDir, destDir);
	} catch (error) {
		console.error('❌ Error copying template files:', error.message);
		process.exit(1);
	}
}

function detectPackageManager(projectDir) {
	// Check for lock files in the project directory
	if (existsSync(join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
	if (existsSync(join(projectDir, 'package-lock.json'))) return 'npm';
	if (existsSync(join(projectDir, 'yarn.lock'))) return 'yarn';
	if (existsSync(join(projectDir, 'bun.lockb'))) return 'bun';

	// Check which package managers are installed
	try {
		execSync('pnpm --version', { stdio: 'ignore' });
		return 'pnpm';
	} catch (e) {
		// pnpm not available
	}

	try {
		execSync('yarn --version', { stdio: 'ignore' });
		return 'yarn';
	} catch (e) {
		// yarn not available
	}

	try {
		execSync('bun --version', { stdio: 'ignore' });
		return 'bun';
	} catch (e) {
		// bun not available
	}

	// Default to npm (usually comes with Node.js)
	return 'npm';
}

function installDependencies(projectDir, packageManager) {
	console.log(`📦 Installing dependencies with ${packageManager}...`);

	const originalCwd = process.cwd();
	try {
		process.chdir(projectDir);

		const commands = {
			pnpm: 'pnpm install',
			npm: 'npm install',
			yarn: 'yarn install',
			bun: 'bun install'
		};

		execSync(commands[packageManager], { stdio: 'inherit' });
		console.log('✅ Dependencies installed successfully!');
	} catch (error) {
		console.error(`❌ Error installing dependencies: ${error.message}`);
		console.log('You can install them manually later.');
	} finally {
		// Restore original working directory
		try {
			process.chdir(originalCwd);
		} catch (e) {
			// Ignore errors when restoring cwd
		}
	}
}

function initGit(projectDir) {
	if (!yes) {
		// In non-interactive mode, skip git init for now
		return;
	}

	const originalCwd = process.cwd();
	try {
		process.chdir(projectDir);
		execSync('git init', { stdio: 'ignore' });
		console.log('✅ Git repository initialized');
	} catch (error) {
		// Git not available or already initialized, that's ok
	} finally {
		// Restore original working directory
		try {
			process.chdir(originalCwd);
		} catch (e) {
			// Ignore errors when restoring cwd
		}
	}
}


// Main execution
(async () => {
	try {
		const name = validateProjectName(projectName || (yes ? 'my-acontext-sandbox' : null));
		
		const projectDir = resolve(process.cwd(), name);

		// Check if directory already exists
		if (existsSync(projectDir)) {
			console.error(`❌ Error: Directory "${name}" already exists`);
			process.exit(1);
		}

		console.log(`\n🚀 Creating Acontext Cloudflare Sandbox project: ${name}\n`);

		// Create project directory
		mkdirSync(projectDir, { recursive: true });

		// Copy template files
		copyTemplate(templateDir, projectDir, name);

		console.log('✅ Template files copied successfully!\n');

		// Install dependencies
		if (!skipInstall) {
			const packageManager = detectPackageManager(projectDir);
			installDependencies(projectDir, packageManager);
		} else {
			console.log('⏭️  Skipping dependency installation (--skip-install flag)');
		}

		// Initialize git (optional)
		initGit(projectDir);

		// Print success message
		console.log(`\n✅ Project "${name}" created successfully!`);
		console.log('\nNext steps:');
		console.log(`  cd ${name}`);
		if (skipInstall) {
			console.log('  pnpm install  # or npm install / yarn install');
		}
		console.log('  pnpm run dev  # or npm run dev / yarn dev');
		console.log('\n📚 Documentation: https://github.com/memodb-io/Acontext');
		console.log('');
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
})();

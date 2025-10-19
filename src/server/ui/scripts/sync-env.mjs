import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory path (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parent directory path
const parentDir = path.resolve(__dirname, '../../');
// Current directory path
const currentDir = path.resolve(__dirname, '../');

console.log('🔄 Syncing environment files from parent directory...');

try {
  // Read all files from parent directory
  const files = fs.readdirSync(parentDir);

  // Filter all files starting with .env
  const envFiles = files.filter(file => file.startsWith('.env'));

  if (envFiles.length === 0) {
    console.log('⚠️  No .env files found in parent directory');
    process.exit(0);
  }

  // Copy all .env files to current directory
  envFiles.forEach(file => {
    const sourcePath = path.join(parentDir, file);
    const targetPath = path.join(currentDir, file);

    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ Copied ${file}`);
  });

  console.log(`✨ Successfully synced ${envFiles.length} environment file(s)`);
} catch (error) {
  console.error('❌ Error syncing environment files:', error.message);
  process.exit(1);
}


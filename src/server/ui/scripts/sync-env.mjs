import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory path (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Current directory path
const currentDir = path.resolve(__dirname, '../');
const envFilePath = path.join(currentDir, '.env');

console.log('🔄 Checking for .env file...');

try {
  // Check if .env file exists
  if (fs.existsSync(envFilePath)) {
    console.log('✅ .env file already exists');
    process.exit(0);
  }

  // Create .env file with default values
  const defaultEnvContent = `NEXT_PUBLIC_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_BASE_PATH=""
API_SERVER_URL="http://localhost:8029"
ROOT_API_BEARER_TOKEN="your-root-api-bearer-token"
DATABASE_URL="postgresql://acontext:helloworld@localhost:15432/acontext"
JAEGER_INTERNAL_URL="http://localhost:16686"
JAEGER_URL="http://localhost:16686"
`;

  fs.writeFileSync(envFilePath, defaultEnvContent, 'utf8');
  console.log('✨ Created .env file with default values');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  process.exit(1);
}


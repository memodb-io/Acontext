/**
 * Simple end-to-end example for sandbox operations.
 *
 * This script demonstrates creating a sandbox, executing commands, and cleaning up.
 * Requires a running Acontext instance with sandbox support enabled.
 */

import { AcontextClient, APIError } from '../src';

function resolveCredentials(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.ACONTEXT_API_KEY || 'sk-ac-your-root-api-bearer-token';
  const baseUrl = process.env.ACONTEXT_BASE_URL || 'http://localhost:8029/api/v1';
  return { apiKey, baseUrl };
}

async function main(): Promise<void> {
  const { apiKey, baseUrl } = resolveCredentials();
  const client = new AcontextClient({ apiKey, baseUrl });

  // Test connectivity
  console.log(`✓ Server ping: ${await client.ping()}`);

  // Create a new sandbox
  console.log('\n--- Creating sandbox ---');
  const sandbox = await client.sandboxes.create();
  console.log(`Sandbox ID: ${sandbox.sandbox_id}`);
  console.log(`Status: ${sandbox.sandbox_status}`);
  console.log(`Expires at: ${sandbox.sandbox_expires_at}`);

  const sandboxId = sandbox.sandbox_id;

  // Execute some commands
  console.log('\n--- Executing commands ---');

  // Run a simple echo command
  let result = await client.sandboxes.execCommand({
    sandboxId,
    command: "echo 'Hello from sandbox!'",
  });
  console.log('echo command:');
  console.log(`  stdout: ${result.stdout.trim()}`);
  console.log(`  exit_code: ${result.exit_code}`);

  // List files in the home directory
  result = await client.sandboxes.execCommand({
    sandboxId,
    command: 'ls -la ~',
  });
  console.log('\nls -la ~:');
  console.log(`  stdout:\n${result.stdout}`);
  console.log(`  exit_code: ${result.exit_code}`);

  // Check Python version
  result = await client.sandboxes.execCommand({
    sandboxId,
    command: 'python3 --version',
  });
  console.log('python3 --version:');
  console.log(`  stdout: ${result.stdout.trim()}`);
  console.log(`  exit_code: ${result.exit_code}`);

  // Create and run a simple Python script
  result = await client.sandboxes.execCommand({
    sandboxId,
    command: "python3 -c \"print('Hello from Python in sandbox!')\"",
  });
  console.log('\nPython script:');
  console.log(`  stdout: ${result.stdout.trim()}`);
  console.log(`  exit_code: ${result.exit_code}`);

  // Kill the sandbox
  console.log('\n--- Killing sandbox ---');
  const killResult = await client.sandboxes.kill(sandboxId);
  console.log(`Kill status: ${killResult.status}`);
  console.log(`Kill message: ${killResult.errmsg || 'success'}`);

  console.log('\n✓ Sandbox example completed successfully!');
}

// Run the example
if (require.main === module) {
  main().catch((error) => {
    if (error instanceof APIError) {
      console.error(`[API error] status=${error.statusCode} message=${error.message}`);
    }
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

/**
 * Example demonstrating file transfer between disk and sandbox.
 *
 * This script demonstrates:
 * 1. Creating a disk and uploading an artifact
 * 2. Creating a sandbox
 * 3. Downloading the artifact to the sandbox (downloadToSandbox)
 * 4. Verifying the file exists in the sandbox
 * 5. Creating a new file in sandbox and uploading it to disk (uploadFromSandbox)
 * 6. Cleaning up resources
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

  let diskId: string | null = null;
  let sandboxId: string | null = null;

  try {
    // Create a disk
    console.log('\n--- Creating disk ---');
    const disk = await client.disks.create();
    diskId = disk.id;
    console.log(`Disk ID: ${diskId}`);

    // Upload a test file as an artifact
    console.log('\n--- Uploading artifact ---');
    const testContent = Buffer.from(
      'Hello from disk artifact!\nThis file was transferred to sandbox.'
    );
    const artifact = await client.disks.artifacts.upsert(diskId, {
      file: ['test_file.txt', testContent, 'text/plain'],
      filePath: '/test/',
      meta: { source: 'disk_to_sandbox_example' },
    });
    console.log(`Artifact uploaded: ${artifact.path}${artifact.filename}`);

    // Create a sandbox
    console.log('\n--- Creating sandbox ---');
    const sandbox = await client.sandboxes.create();
    sandboxId = sandbox.sandbox_id;
    console.log(`Sandbox ID: ${sandboxId}`);
    console.log(`Status: ${sandbox.sandbox_status}`);

    // Download the artifact to the sandbox
    console.log('\n--- Downloading artifact to sandbox ---');
    const success = await client.disks.artifacts.downloadToSandbox(diskId, {
      filePath: '/test/',
      filename: 'test_file.txt',
      sandboxId: sandboxId,
      sandboxPath: '/workspace/',
    });
    console.log(`Download success: ${success}`);

    // Verify the file exists in the sandbox
    console.log('\n--- Verifying file in sandbox ---');
    let result = await client.sandboxes.execCommand({
      sandboxId: sandboxId,
      command: 'ls -la /workspace/test_file.txt',
    });
    console.log(`ls result:\n${result.stdout}`);
    console.log(`exit_code: ${result.exit_code}`);

    if (result.exit_code === 0) {
      console.log('✓ File exists in sandbox!');
    } else {
      console.log('✗ File not found in sandbox');
    }

    // Read the file content in sandbox
    console.log('\n--- Reading file content in sandbox ---');
    result = await client.sandboxes.execCommand({
      sandboxId: sandboxId,
      command: 'cat /workspace/test_file.txt',
    });
    console.log(`File content:\n${result.stdout}`);
    console.log(`exit_code: ${result.exit_code}`);

    // Create a new file in sandbox
    console.log('\n--- Creating new file in sandbox ---');
    result = await client.sandboxes.execCommand({
      sandboxId: sandboxId,
      command: "echo 'Generated in sandbox!' > /workspace/sandbox_output.txt",
    });
    console.log(`File created, exit_code: ${result.exit_code}`);

    console.log('\n--- Reading new file in sandbox ---');
    result = await client.sandboxes.execCommand({
      sandboxId: sandboxId,
      command: 'cat /workspace/sandbox_output.txt',
    });
    console.log(`File content:\n${result.stdout}`);
    console.log(`exit_code: ${result.exit_code}`);

    // Upload the sandbox file to disk
    console.log('\n--- Uploading file from sandbox to disk ---');
    const uploadedArtifact = await client.disks.artifacts.uploadFromSandbox(diskId, {
      sandboxId: sandboxId,
      sandboxPath: '/workspace/',
      sandboxFilename: 'sandbox_output.txt',
      filePath: '/results/',
    });
    console.log(`Uploaded artifact: ${uploadedArtifact.path}${uploadedArtifact.filename}`);

    // Verify the uploaded artifact by reading it back
    console.log('\n--- Verifying uploaded artifact ---');
    const artifactInfo = await client.disks.artifacts.get(diskId, {
      filePath: '/results/',
      filename: 'sandbox_output.txt',
      withContent: true,
    });
    console.log(`Artifact path: ${artifactInfo.artifact.path}${artifactInfo.artifact.filename}`);
    if (artifactInfo.content) {
      console.log(`Artifact content: ${artifactInfo.content.raw}`);
    }

    const artifactInfos = await client.disks.artifacts.grepArtifacts(diskId, {
      query: 'Generated in',
    });

    console.log('Grep result', artifactInfos);

    console.log('\n✓ Disk-sandbox file transfer example completed successfully!');
  } finally {
    // Cleanup: Kill sandbox and delete disk
    console.log('\n--- Cleanup ---');

    if (sandboxId) {
      try {
        const killResult = await client.sandboxes.kill(sandboxId);
        console.log(`Sandbox killed: status=${killResult.status}`);
      } catch (e) {
        if (e instanceof APIError) {
          console.log(`Failed to kill sandbox: ${e.message}`);
        } else {
          throw e;
        }
      }
    }
  }
}

// Run the example
if (require.main === module) {
  main().catch((error) => {
    if (error instanceof APIError) {
      console.error(`[API error] status=${error.statusCode} message=${error.message}`);
    }
    throw error;
  });
}

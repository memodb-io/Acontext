/// <reference types="node" />
/**
 * Structured end-to-end exercise for the Acontext TypeScript SDK.
 *
 * The script drives every public client method so it can double as a
 * lightweight e2e test when pointed at a running Acontext instance.
 */

import {
  AcontextClient,
  FileUpload,
  buildAcontextMessage,
  APIError,
  TransportError,
  AcontextError,
  Space,
  Session,
  Disk,
} from '../src';

const SPACE_CONFIG_NAME = 'sdk-e2e-space';
const FILE_NAME = 'sdk-e2e-retro.md';
const FILE_CONTENT = Buffer.from('# Retro Notes\nWe shipped file uploads successfully!\n');

function resolveCredentials(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.ACONTEXT_API_KEY || 'sk-ac-your-root-api-bearer-token';
  const baseUrl = process.env.ACONTEXT_BASE_URL || 'http://localhost:8029/api/v1';
  return { apiKey, baseUrl };
}

async function exerciseSpaces(
  client: AcontextClient
): Promise<{ spaceId: string; summary: Record<string, unknown> }> {
  const summary: Record<string, unknown> = {};

  summary.initial_list = await client.spaces.list();
  const space: Space = await client.spaces.create({ configs: { name: SPACE_CONFIG_NAME } });
  const spaceId = space.id;
  summary.created_space = space;

  const configsResp = await client.spaces.getConfigs(spaceId);
  const configs = configsResp.configs || {};
  await client.spaces.updateConfigs(spaceId, { configs: { ...configs, sdk_e2e: true } });
  summary.updated_configs = await client.spaces.getConfigs(spaceId);

  summary.list_after_create = await client.spaces.list();

  return { spaceId, summary };
}

// NOTE: Block operations are commented out because API passes through to core
// async function exerciseBlocks(
//   client: AcontextClient,
//   spaceId: string
// ): Promise<Record<string, unknown>> {
//   const summary: Record<string, unknown> = {};
//   summary.initial_blocks = await client.blocks.list(spaceId);
//
//   const folder = await client.blocks.create(spaceId, { blockType: 'folder', title: 'SDK E2E Folder' });
//   const pageA = await client.blocks.create(spaceId, { parentId: folder.id, blockType: 'page', title: 'SDK E2E Page A' });
//   const pageB = await client.blocks.create(spaceId, { parentId: folder.id, blockType: 'page', title: 'SDK E2E Page B' });
//   const textBlock = await client.blocks.create(spaceId, {
//     parentId: pageA.id,
//     blockType: 'text',
//     title: 'Initial Block',
//     props: { text: 'Plan the sprint goals' },
//   });
//
//   summary.text_block_properties = await client.blocks.getProperties(spaceId, textBlock.id);
//   await client.blocks.updateProperties(spaceId, textBlock.id, {
//     title: 'Updated Block',
//     props: { text: 'Updated block contents' },
//   });
//
//   await client.blocks.move(spaceId, textBlock.id, { parentId: pageB.id });
//   await client.blocks.updateSort(spaceId, textBlock.id, { sort: 0 });
//
//   const textBlock2 = await client.blocks.create(spaceId, {
//     parentId: pageB.id,
//     blockType: 'text',
//     title: 'Another Block',
//     props: { text: 'Another block contents' },
//   });
//   await client.blocks.updateSort(spaceId, textBlock2.id, { sort: 1 });
//
//   summary.blocks_after_updates = await client.blocks.list(spaceId);
//
//   await client.blocks.delete(spaceId, textBlock.id);
//   await client.blocks.delete(spaceId, textBlock2.id);
//   await client.blocks.delete(spaceId, pageB.id);
//   await client.blocks.delete(spaceId, pageA.id);
//   await client.blocks.delete(spaceId, folder.id);
//   summary.final_blocks = await client.blocks.list(spaceId);
//
//   return summary;
// }

function buildFileUpload(): FileUpload {
  return new FileUpload({
    filename: FILE_NAME,
    content: FILE_CONTENT,
    contentType: 'text/markdown',
  });
}

async function exerciseSessions(
  client: AcontextClient,
  spaceId: string
): Promise<Record<string, unknown>> {
  const summary: Record<string, unknown> = {};

  summary.initial_sessions = await client.sessions.list({
    spaceId,
    notConnected: false,
  });
  const session: Session = await client.sessions.create({
    spaceId,
    configs: { mode: 'sdk-e2e' },
  });
  const sessionId = session.id;
  summary.session_created = session;

  await client.sessions.updateConfigs(sessionId, { configs: { mode: 'sdk-e2e-updated' } });
  summary.session_configs = await client.sessions.getConfigs(sessionId);

  await client.sessions.connectToSpace(sessionId, { spaceId });
  summary.tasks = await client.sessions.getTasks(sessionId);

  // Store message in acontext format
  const acontextBlob = buildAcontextMessage({
    role: 'user',
    parts: ['Hello from the SDK e2e test!'],
  });
  await client.sessions.storeMessage(sessionId, acontextBlob, { format: 'acontext' });

  // Store message in acontext format with file upload
  const fileField = 'retro_notes';
  const fileBlob = buildAcontextMessage({
    role: 'user',
    parts: [{ type: 'file', file_field: fileField }],
  });
  await client.sessions.storeMessage(sessionId, fileBlob, {
    format: 'acontext',
    fileField,
    file: buildFileUpload(),
  });

  // Store tool-call message
  const toolBlob = buildAcontextMessage({
    role: 'assistant',
    parts: [
      'Triggering weather tool.',
      {
        type: 'tool-call',
        meta: {
          id: 'call_001',
          name: 'search_apis',
          arguments: '{"query": "weather API free", "type": "public"}',
        },
      },
    ],
  });
  await client.sessions.storeMessage(sessionId, toolBlob, { format: 'acontext' });

  // Store OpenAI compatible messages
  const openaiUser = { role: 'user', content: 'Hello from OpenAI format' };
  await client.sessions.storeMessage(sessionId, openaiUser, { format: 'openai' });

  const openaiAssistant = {
    role: 'assistant',
    content: 'Answering via OpenAI compatible payload.',
    tool_calls: [
      {
        type: 'function',
        id: 'call_002',
        function: {
          name: 'search_apis',
          arguments: '{"query": "weather API free", "type": "public"}',
        },
      },
    ],
  };
  await client.sessions.storeMessage(sessionId, openaiAssistant, { format: 'openai' });

  // Store Anthropic compatible messages
  const anthropicUser = { role: 'user', content: 'Hello from Anthropic format' };
  await client.sessions.storeMessage(sessionId, anthropicUser, { format: 'anthropic' });

  const anthropicAssistant = {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'Answering via Anthropic compatible payload.',
      },
      {
        id: 'call_003',
        type: 'tool_use',
        name: 'search_apis',
        input: { query: 'weather API free', type: 'public' },
      },
    ],
  };
  await client.sessions.storeMessage(sessionId, anthropicAssistant, { format: 'anthropic' });

  summary.messages = await client.sessions.getMessages(sessionId, {
    limit: 10,
    withAssetPublicUrl: true,
    format: 'acontext',
    timeDesc: true,
  });

  await client.sessions.delete(sessionId);
  summary.sessions_after_delete = await client.sessions.list({
    spaceId,
    notConnected: false,
  });

  return summary;
}

async function exerciseDisks(client: AcontextClient): Promise<Record<string, unknown>> {
  const summary: Record<string, unknown> = {};

  summary.initial_disks = await client.disks.list();
  const disk: Disk = await client.disks.create();
  const diskId = disk.id;
  summary.disk_created = disk;

  const upload = buildFileUpload();
  await client.disks.artifacts.upsert(diskId, {
    file: upload,
    filePath: '/notes/',
    meta: { source: 'sdk-e2e' },
  });

  summary.artifact_get = await client.disks.artifacts.get(diskId, {
    filePath: '/notes/',
    filename: FILE_NAME,
    withPublicUrl: true,
    withContent: true,
    expire: 60,
  });

  await client.disks.artifacts.update(diskId, {
    filePath: '/notes/',
    filename: FILE_NAME,
    meta: { source: 'sdk-e2e', reviewed: true },
  });

  summary.artifact_list = await client.disks.artifacts.list(diskId, { path: '/notes/' });

  await client.disks.artifacts.delete(diskId, { filePath: 'notes', filename: FILE_NAME });
  await client.disks.delete(diskId);
  summary.disks_after_delete = await client.disks.list();

  return summary;
}

async function run(): Promise<Record<string, unknown>> {
  const { apiKey, baseUrl } = resolveCredentials();
  const report: Record<string, unknown> = {};

  const client = new AcontextClient({ apiKey, baseUrl });

  // Test connectivity with ping
  const pingResult = await client.ping();
  report.ping = pingResult;
  console.log(`✓ Server ping: ${pingResult}`);

  const { spaceId, summary: spacesSummary } = await exerciseSpaces(client);
  report.spaces = spacesSummary;

  // NOTE: Block operations are commented out because API passes through to core
  // report.blocks = await exerciseBlocks(client, spaceId);

  report.sessions = await exerciseSessions(client, spaceId);
  report.disks = await exerciseDisks(client);
  await client.spaces.delete(spaceId);
  report.spaces_after_delete = await client.spaces.list();

  return report;
}

async function main(): Promise<void> {
  try {
    const report = await run();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error instanceof APIError) {
      console.error(
        `[API error] status=${error.statusCode} code=${error.code} message=${error.message}`
      );
      if (error.payload) {
        console.error(`payload: ${JSON.stringify(error.payload)}`);
      }
      throw error;
    }
    if (error instanceof TransportError) {
      console.error(`[Transport error] ${error.message}`);
      throw error;
    }
    if (error instanceof AcontextError) {
      console.error(`[SDK error] ${error.message}`);
      throw error;
    }
    throw error;
  }
}

// Run the example
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

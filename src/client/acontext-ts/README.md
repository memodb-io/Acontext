# Acontext client for TypeScript

TypeScript SDK for interacting with the Acontext REST API.

## Installation

```bash
npm install @acontext/acontext
```

## Quickstart

```typescript
import { AcontextClient, MessagePart } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk-ac-your-root-api-bearer-token' });

// List spaces for the authenticated project
const spaces = await client.spaces.list();

// Create a session bound to the first space
const session = await client.sessions.create({ spaceId: spaces.items[0].id });

// Send a text message to the session
await client.sessions.sendMessage(
  session.id,
  {
    role: 'user',
    parts: [MessagePart.textPart('Hello from TypeScript!')],
  },
  { format: 'acontext' }
);

// Flush session buffer when needed
await client.sessions.flush(session.id);
```

See the inline documentation for the full list of helpers covering sessions, spaces, disks, and artifact uploads.

## Health Check

Test connectivity to the Acontext API server:

```typescript
import { AcontextClient } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk-ac-your-root-api-bearer-token' });

// Ping the server
const pong = await client.ping();
console.log(`Server responded: ${pong}`); // Output: Server responded: pong
```

This is useful for:
- Verifying API connectivity before performing operations
- Health checks in monitoring systems
- Debugging connection issues

## Managing disks and artifacts

Artifacts now live under project disks. Create a disk first, then upload files through the disk-scoped helper:

```typescript
import { AcontextClient, FileUpload } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk-ac-your-root-api-bearer-token' });

const disk = await client.disks.create();
await client.disks.artifacts.upsert(
  disk.id,
  {
    file: new FileUpload({
      filename: 'retro_notes.md',
      content: Buffer.from('# Retro Notes\nWe shipped file uploads successfully!\n'),
      contentType: 'text/markdown',
    }),
    filePath: '/notes/',
    meta: { source: 'readme-demo' },
  }
);
```

## Working with blocks

```typescript
import { AcontextClient } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk-ac-your-root-api-bearer-token' });

const space = await client.spaces.create();
const page = await client.blocks.create(space.id, {
  blockType: 'page',
  title: 'Kick-off Notes',
});
await client.blocks.create(space.id, {
  parentId: page.id,
  blockType: 'text',
  title: 'First block',
  props: { text: 'Plan the sprint goals' },
});
```

## Managing sessions

### Flush session buffer

The `flush` method clears the session buffer, useful for managing session state:

```typescript
const result = await client.sessions.flush('session-uuid');
console.log(result); // { status: 0, errmsg: '' }
```

## Working with tools

The SDK provides APIs to manage tool names within your project:

### Get tool names

```typescript
const tools = await client.tools.getToolName();
for (const tool of tools) {
  console.log(`${tool.name} (used in ${tool.sop_count} SOPs)`);
}
```

### Rename tool names

```typescript
const result = await client.tools.renameToolName({
  rename: [
    { oldName: 'calculate', newName: 'calculate_math' },
    { oldName: 'search', newName: 'search_web' },
  ],
});
console.log(result); // { status: 0, errmsg: '' }
```

## Agent Tools

The SDK provides agent tools that allow LLMs (OpenAI, Anthropic) to interact with Acontext disks through function calling. These tools can be converted to OpenAI or Anthropic tool schemas and executed when the LLM calls them.

### Pre-configured Disk Tools

The SDK includes a pre-configured `DISK_TOOLS` pool with four disk operation tools:

- **`write_file`**: Write text content to a file
- **`read_file`**: Read a text file with optional line offset and limit
- **`replace_string`**: Replace strings in a file
- **`list_artifacts`**: List files and directories in a path

### Getting Tool Schemas for LLM APIs

Convert tools to the appropriate format for your LLM provider:

```typescript
import { AcontextClient, DISK_TOOLS } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk-ac-your-root-api-bearer-token' });

// Get OpenAI-compatible tool schemas
const openaiTools = DISK_TOOLS.toOpenAIToolSchema();

// Get Anthropic-compatible tool schemas
const anthropicTools = DISK_TOOLS.toAnthropicToolSchema();

// Use with OpenAI API
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: 'your-openai-key' });
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Write a file called hello.txt with "Hello, World!"' }],
  tools: openaiTools,
});
```

### Executing Tools

When an LLM calls a tool, execute it using the tool pool:

```typescript
import { AcontextClient, DISK_TOOLS } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk-ac-your-root-api-bearer-token' });

// Create a disk for the tools to operate on
const disk = await client.disks.create();

// Create a context for the tools
const ctx = DISK_TOOLS.formatContext(client, disk.id);

// Execute a tool (e.g., after LLM returns a tool call)
const result = await DISK_TOOLS.executeTool(ctx, 'write_file', {
  filename: 'hello.txt',
  file_path: '/notes/',
  content: 'Hello, World!',
});
console.log(result); // File 'hello.txt' written successfully to '/notes/hello.txt'

// Read the file
const readResult = await DISK_TOOLS.executeTool(ctx, 'read_file', {
  filename: 'hello.txt',
  file_path: '/notes/',
});
console.log(readResult);

// List files in a directory
const listResult = await DISK_TOOLS.executeTool(ctx, 'list_artifacts', {
  file_path: '/notes/',
});
console.log(listResult);

// Replace a string in a file
const replaceResult = await DISK_TOOLS.executeTool(ctx, 'replace_string', {
  filename: 'hello.txt',
  file_path: '/notes/',
  old_string: 'Hello',
  new_string: 'Hi',
});
console.log(replaceResult);
```

### Creating Custom Tools

You can create custom tools by extending `AbstractBaseTool`:

```typescript
import { AbstractBaseTool, BaseContext, BaseToolPool } from '@acontext/acontext';

interface MyContext extends BaseContext {
  // Your context properties
}

class MyCustomTool extends AbstractBaseTool {
  readonly name = 'my_custom_tool';
  readonly description = 'A custom tool that does something';
  readonly arguments = {
    param1: {
      type: 'string',
      description: 'First parameter',
    },
  };
  readonly requiredArguments = ['param1'];

  async execute(ctx: MyContext, llmArguments: Record<string, unknown>): Promise<string> {
    const param1 = llmArguments.param1 as string;
    // Your custom logic here
    return `Result: ${param1}`;
  }
}

// Create a custom tool pool
class MyToolPool extends BaseToolPool {
  formatContext(...args: unknown[]): MyContext {
    // Create and return your context
    return {};
  }
}

const myPool = new MyToolPool();
myPool.addTool(new MyCustomTool());
```

## Semantic search within spaces

The SDK provides a powerful semantic search API for finding content within your spaces:

### 1. Experience Search (Advanced AI-powered search)

The most sophisticated search that can operate in two modes: **fast** (quick semantic search) or **agentic** (AI-powered iterative refinement).

```typescript
import { AcontextClient } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk_project_token' });

// Fast mode - quick semantic search
const result = await client.spaces.experienceSearch('space-uuid', {
  query: 'How to implement authentication?',
  limit: 10,
  mode: 'fast',
  semanticThreshold: 0.8,
});

// Agentic mode - AI-powered iterative search
const agenticResult = await client.spaces.experienceSearch('space-uuid', {
  query: 'What are the best practices for API security?',
  limit: 10,
  mode: 'agentic',
  maxIterations: 20,
});

// Access results
for (const block of result.cited_blocks) {
  console.log(`${block.title} (distance: ${block.distance})`);
}

if (result.final_answer) {
  console.log(`AI Answer: ${result.final_answer}`);
}
```


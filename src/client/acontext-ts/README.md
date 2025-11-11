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
```

See the inline documentation for the full list of helpers covering sessions, spaces, disks, and artifact uploads.

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

## Semantic search within spaces

The SDK provides three powerful semantic search APIs for finding content within your spaces:

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

### 2. Semantic Global (Search page/folder titles)

Search for pages and folders by their titles using semantic similarity (like a semantic version of `glob`):

```typescript
// Find pages about authentication
const results = await client.spaces.semanticGlobal('space-uuid', {
  query: 'authentication and authorization pages',
  limit: 10,
  threshold: 1.0, // Only show results with distance < 1.0
});

for (const block of results) {
  console.log(`${block.title} - ${block.type}`);
}
```

### 3. Semantic Grep (Search content blocks)

Search through actual content blocks using semantic similarity (like a semantic version of `grep`):

```typescript
// Find code examples for JWT validation
const results = await client.spaces.semanticGrep('space-uuid', {
  query: 'JWT token validation code examples',
  limit: 15,
  threshold: 0.7,
});

for (const block of results) {
  console.log(`${block.title} - distance: ${block.distance}`);
  const content = block.props.text || block.props.content;
  if (content) {
    console.log(`Content: ${String(content).substring(0, 100)}...`);
  }
}
```


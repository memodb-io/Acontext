# acontext client for TypeScript

TypeScript SDK for interacting with the Acontext REST API.

## Installation

```bash
npm install acontext
```

## Quickstart

```typescript
import { AcontextClient, MessagePart } from 'acontext';

const client = new AcontextClient({ apiKey: 'sk_project_token' });

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
import { AcontextClient, FileUpload } from 'acontext';

const client = new AcontextClient({ apiKey: 'sk_project_token' });

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
import { AcontextClient } from 'acontext';

const client = new AcontextClient({ apiKey: 'sk_project_token' });

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


/**
 * Integration tests for the Acontext TypeScript SDK.
 * These tests require a running Acontext API instance.
 */

import { AcontextClient, MessagePart, FileUpload, buildAcontextMessage } from '../src/index';

describe('AcontextClient Integration Tests', () => {
  const apiKey = process.env.ACONTEXT_API_KEY || 'sk-ac-your-root-api-bearer-token';
  const baseUrl = process.env.ACONTEXT_BASE_URL || 'http://localhost:8029/api/v1';

  let client: AcontextClient;
  let createdSpaceId: string | null = null;
  let createdSessionId: string | null = null;
  let createdDiskId: string | null = null;
  let createdBlockIds: string[] = [];

  beforeAll(() => {
    client = new AcontextClient({ apiKey, baseUrl });
  });

  afterAll(async () => {
    // Cleanup: delete all created resources
    if (createdBlockIds.length > 0 && createdSpaceId) {
      for (const blockId of createdBlockIds) {
        try {
          await client.blocks.delete(createdSpaceId, blockId);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
    if (createdSessionId) {
      try {
        await client.sessions.delete(createdSessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (createdDiskId) {
      try {
        await client.disks.delete(createdDiskId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (createdSpaceId) {
      try {
        await client.spaces.delete(createdSpaceId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Health Check', () => {
    test('should ping the server', async () => {
      const result = await client.ping();
      expect(result).toBe('pong');
    });
  });

  describe('Spaces API', () => {
    test('should list spaces', async () => {
      const spaces = await client.spaces.list();
      expect(spaces).toBeDefined();
      expect(spaces.items).toBeInstanceOf(Array);
      expect(spaces.has_more).toBeDefined();
    });

    test('should create a space', async () => {
      const space = await client.spaces.create({
        configs: { name: 'Test Space' },
      });
      expect(space).toBeDefined();
      expect(space.id).toBeDefined();
      expect(space.project_id).toBeDefined();
      expect(space.configs).toBeDefined();
      createdSpaceId = space.id;
    });

    test('should get space configs', async () => {
      if (!createdSpaceId) {
        throw new Error('Space not created');
      }
      const space = await client.spaces.getConfigs(createdSpaceId);
      expect(space).toBeDefined();
      expect(space.id).toBe(createdSpaceId);
      expect(space.configs).toBeDefined();
    });

    test('should update space configs', async () => {
      if (!createdSpaceId) {
        throw new Error('Space not created');
      }
      await client.spaces.updateConfigs(createdSpaceId, {
        configs: { name: 'Updated Test Space', test: true },
      });
      const space = await client.spaces.getConfigs(createdSpaceId);
      expect(space.configs).toMatchObject({ name: 'Updated Test Space', test: true });
    });

    // TODO: Uncomment these tests when the search APIs are ready to test
    // test('should perform experience search with fast mode', async () => {
    //   if (!createdSpaceId) {
    //     throw new Error('Space not created');
    //   }
    //   const result = await client.spaces.experienceSearch(createdSpaceId, {
    //     query: 'test query',
    //     limit: 5,
    //     mode: 'fast',
    //   });
    //   expect(result).toBeDefined();
    //   expect(result.cited_blocks).toBeInstanceOf(Array);
    //   expect(result.final_answer === null || typeof result.final_answer === 'string').toBe(true);
    // });

    // test('should perform experience search with agentic mode', async () => {
    //   if (!createdSpaceId) {
    //     throw new Error('Space not created');
    //   }
    //   const result = await client.spaces.experienceSearch(createdSpaceId, {
    //     query: 'API best practices',
    //     limit: 10,
    //     mode: 'agentic',
    //     semanticThreshold: 0.8,
    //     maxIterations: 20,
    //   });
    //   expect(result).toBeDefined();
    //   expect(result.cited_blocks).toBeInstanceOf(Array);
    // });
  });

  describe('Sessions API', () => {
    test('should create a session', async () => {
      if (!createdSpaceId) {
        throw new Error('Space not created');
      }
      const session = await client.sessions.create({
        spaceId: createdSpaceId,
        configs: { mode: 'test' },
      });
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.space_id).toBe(createdSpaceId);
      createdSessionId = session.id;
    });

    test('should store a message', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const message = await client.sessions.storeMessage(
        createdSessionId,
        {
          role: 'user',
          parts: [MessagePart.textPart('Hello from TypeScript!')],
        },
        { format: 'acontext' }
      );
      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.session_id).toBe(createdSessionId);
      expect(message.role).toBe('user');
      expect(message.parts).toBeInstanceOf(Array);
      expect(message.parts.length).toBeGreaterThan(0);
    });

    test('should get messages', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const messages = await client.sessions.getMessages(createdSessionId, {
        format: 'acontext',
      });
      expect(messages).toBeDefined();
      expect(messages.items).toBeInstanceOf(Array);
      expect(messages.has_more).toBeDefined();
    });

    test('should get messages with edit strategies', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const editStrategies = [
        { type: 'remove_tool_result' as const, params: { keep_recent_n_tool_results: 3 } },
      ];
      const messages = await client.sessions.getMessages(createdSessionId, {
        format: 'openai',
        editStrategies,
      });
      expect(messages).toBeDefined();
      expect(messages.items).toBeInstanceOf(Array);
      expect(messages.has_more).toBeDefined();
    });

    test('should get messages without edit strategies', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const messages = await client.sessions.getMessages(createdSessionId, {
        format: 'openai',
      });
      expect(messages).toBeDefined();
      expect(messages.items).toBeInstanceOf(Array);
      expect(messages.has_more).toBeDefined();
    });

    test('should store message with file upload', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const fileField = 'test_file';
      const blob = buildAcontextMessage({
        role: 'user',
        parts: [MessagePart.fileFieldPart(fileField)],
      });
      const message = await client.sessions.storeMessage(createdSessionId, blob, {
        format: 'acontext',
        fileField: fileField,
        file: new FileUpload({
          filename: 'test.txt',
          content: Buffer.from('Hello, World!'),
          contentType: 'text/plain',
        }),
      });
      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
    });

    test('should get tasks', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const tasks = await client.sessions.getTasks(createdSessionId);
      expect(tasks).toBeDefined();
      expect(tasks.items).toBeInstanceOf(Array);
      expect(tasks.has_more).toBeDefined();
    });

    test('should get learning status', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const learningStatus = await client.sessions.getLearningStatus(createdSessionId);
      expect(learningStatus).toBeDefined();
      expect(learningStatus.space_digested_count).toBeDefined();
      expect(learningStatus.not_space_digested_count).toBeDefined();
      expect(typeof learningStatus.space_digested_count).toBe('number');
      expect(typeof learningStatus.not_space_digested_count).toBe('number');
      expect(learningStatus.space_digested_count).toBeGreaterThanOrEqual(0);
      expect(learningStatus.not_space_digested_count).toBeGreaterThanOrEqual(0);
    });

    test('should get token counts', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      const tokenCounts = await client.sessions.getTokenCounts(createdSessionId);
      expect(tokenCounts).toBeDefined();
      expect(tokenCounts.total_tokens).toBeDefined();
      expect(typeof tokenCounts.total_tokens).toBe('number');
      expect(tokenCounts.total_tokens).toBeGreaterThanOrEqual(0);
    });

    test('should update session configs', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }
      await client.sessions.updateConfigs(createdSessionId, {
        configs: { mode: 'test-updated' },
      });
      const session = await client.sessions.getConfigs(createdSessionId);
      expect(session.configs).toMatchObject({ mode: 'test-updated' });
    });

    test('should store messages in OpenAI format', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }

      // Store user message in OpenAI format
      const userMessage = {
        role: 'user',
        content: 'Hello, how are you?',
      };

      const sentUserMessage = await client.sessions.storeMessage(
        createdSessionId,
        userMessage,
        { format: 'openai' }
      );
      expect(sentUserMessage).toBeDefined();
      expect(sentUserMessage.id).toBeDefined();
      expect(sentUserMessage.session_id).toBe(createdSessionId);
      expect(sentUserMessage.role).toBe('user');

      // Store assistant message in OpenAI format
      const assistantMessage = {
        role: 'assistant',
        content: 'I am doing well, thank you for asking!',
      };

      const sentAssistantMessage = await client.sessions.storeMessage(
        createdSessionId,
        assistantMessage,
        { format: 'openai' }
      );
      expect(sentAssistantMessage).toBeDefined();
      expect(sentAssistantMessage.id).toBeDefined();
      expect(sentAssistantMessage.session_id).toBe(createdSessionId);
      expect(sentAssistantMessage.role).toBe('assistant');
    });

    test('should store Anthropic response format messages', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }

      // Store user message
      const userMessage = {
        role: 'user',
        content: 'Hello, how are you?',
      };

      const sentUserMessage = await client.sessions.storeMessage(
        createdSessionId,
        userMessage,
        { format: 'openai' }
      );
      expect(sentUserMessage).toBeDefined();
      expect(sentUserMessage.role).toBe('user');

      // Simulate Anthropic API response format
      const anthropicResponse = {
        id: 'msg_01XFDUDYJgAACzvnptvVoYEL',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          {
            type: 'text',
            text: 'Hello! I\'m doing well, thank you for asking. How can I assist you today?',
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      // Store Anthropic response as a message
      const sentAnthropicMessage = await client.sessions.storeMessage(
        createdSessionId,
        anthropicResponse,
        { format: 'openai' }
      );
      expect(sentAnthropicMessage).toBeDefined();
      expect(sentAnthropicMessage.id).toBeDefined();
      expect(sentAnthropicMessage.session_id).toBe(createdSessionId);
      expect(sentAnthropicMessage.role).toBe('assistant');
    });

    test('should store OpenAI chat completion response format messages', async () => {
      if (!createdSessionId) {
        throw new Error('Session not created');
      }

      // Store user message
      const userMessage = {
        role: 'user',
        content: 'Hello, how are you?',
      };

      const sentUserMessage = await client.sessions.storeMessage(
        createdSessionId,
        userMessage,
        { format: 'openai' }
      );
      expect(sentUserMessage).toBeDefined();
      expect(sentUserMessage.role).toBe('user');

      // Simulate OpenAI chat completion response message format
      const openaiResponseMessage = {
        role: 'assistant',
        content: 'I\'m doing well, thank you for asking! How can I help you today?',
        refusal: null,
      };

      // Store OpenAI response message
      const sentOpenAIMessage = await client.sessions.storeMessage(
        createdSessionId,
        openaiResponseMessage,
        { format: 'openai' }
      );

      expect(sentOpenAIMessage).toBeDefined();
      expect(sentOpenAIMessage.id).toBeDefined();
      expect(sentOpenAIMessage.session_id).toBe(createdSessionId);
      expect(sentOpenAIMessage.role).toBe('assistant');
    });
  });

  describe('Disks API', () => {
    test('should list disks', async () => {
      const disks = await client.disks.list();
      expect(disks).toBeDefined();
      expect(disks.items).toBeInstanceOf(Array);
      expect(disks.has_more).toBeDefined();
    });

    test('should create a disk', async () => {
      const disk = await client.disks.create();
      expect(disk).toBeDefined();
      expect(disk.id).toBeDefined();
      expect(disk.project_id).toBeDefined();
      createdDiskId = disk.id;
    });

    test('should upsert an artifact', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }
      const artifact = await client.disks.artifacts.upsert(createdDiskId, {
        file: new FileUpload({
          filename: 'test.txt',
          content: Buffer.from('Hello, World!'),
          contentType: 'text/plain',
        }),
        filePath: '/',
        meta: { source: 'test' },
      });
      expect(artifact).toBeDefined();
      expect(artifact.disk_id).toBe(createdDiskId);
      expect(artifact.filename).toBe('test.txt');
    });

    test('should get an artifact', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }
      const artifact = await client.disks.artifacts.get(createdDiskId, {
        filePath: '/',
        filename: 'test.txt',
        withPublicUrl: true,
        withContent: true,
      });
      expect(artifact).toBeDefined();
      expect(artifact.artifact).toBeDefined();
      expect(artifact.artifact.filename).toBe('test.txt');
    });

    test('should update an artifact', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }
      const artifact = await client.disks.artifacts.update(createdDiskId, {
        filePath: '/',
        filename: 'test.txt',
        meta: { source: 'test', updated: true },
      });
      expect(artifact).toBeDefined();
      expect(artifact.artifact.meta).toMatchObject({ source: 'test', updated: true });
    });

    test('should list artifacts', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }
      const result = await client.disks.artifacts.list(createdDiskId, {
        path: '/',
      });
      expect(result).toBeDefined();
      expect(result.artifacts).toBeInstanceOf(Array);
      expect(result.directories).toBeInstanceOf(Array);
    });

    test('should delete an artifact', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }
      await client.disks.artifacts.delete(createdDiskId, {
        filePath: '/',
        filename: 'test.txt',
      });
      // Should not throw if deletion succeeds
    });
  });

  // NOTE: All Blocks API tests are commented out because API passes through to core
  // describe('Blocks API', () => {
  //   test('should list blocks', async () => {
  //     if (!createdSpaceId) {
  //       throw new Error('Space not created');
  //     }
  //     const blocks = await client.blocks.list(createdSpaceId);
  //     expect(Array.isArray(blocks)).toBe(true);
  //   });

  //   test('should create a page block', async () => {
  //     if (!createdSpaceId) {
  //       throw new Error('Space not created');
  //     }
  //     const page = await client.blocks.create(createdSpaceId, {
  //       blockType: 'page',
  //       title: 'Test Page',
  //     });
  //     expect(page).toBeDefined();
  //     expect(page.id).toBeDefined();
  //     createdBlockIds.push(page.id);
  //   });

  //   test('should create a text block', async () => {
  //     if (!createdSpaceId || createdBlockIds.length === 0) {
  //       throw new Error('Space or parent block not created');
  //     }
  //     const textBlock = await client.blocks.create(createdSpaceId, {
  //       blockType: 'text',
  //       parentId: createdBlockIds[0],
  //       title: 'Test Block',
  //       props: { text: 'This is a test block' },
  //     });
  //     expect(textBlock).toBeDefined();
  //     expect(textBlock.id).toBeDefined();
  //     createdBlockIds.push(textBlock.id);
  //   });

  //   test('should get block properties', async () => {
  //     if (!createdSpaceId || createdBlockIds.length === 0) {
  //       throw new Error('Space or block not created');
  //     }
  //     const block = await client.blocks.getProperties(createdSpaceId, createdBlockIds[0]);
  //     expect(block).toBeDefined();
  //     expect(block.id).toBe(createdBlockIds[0]);
  //   });

  //   test('should update block properties', async () => {
  //     if (!createdSpaceId || createdBlockIds.length === 0) {
  //       throw new Error('Space or block not created');
  //     }
  //     await client.blocks.updateProperties(createdSpaceId, createdBlockIds[0], {
  //       title: 'Updated Block Title',
  //       props: { text: 'Updated content' },
  //     });
  //     const block = await client.blocks.getProperties(createdSpaceId, createdBlockIds[0]);
  //     expect(block.title).toBe('Updated Block Title');
  //   });

  //   test('should move a block', async () => {
  //     if (!createdSpaceId || createdBlockIds.length < 2) {
  //       throw new Error('Space or blocks not created');
  //     }
  //     await client.blocks.move(createdSpaceId, createdBlockIds[1], {
  //       parentId: createdBlockIds[0],
  //     });
  //     const block = await client.blocks.getProperties(createdSpaceId, createdBlockIds[1]);
  //     expect(block.parent_id).toBe(createdBlockIds[0]);
  //   });

  //   test('should update block sort', async () => {
  //     if (!createdSpaceId || createdBlockIds.length === 0) {
  //       throw new Error('Space or block not created');
  //     }
  //     await client.blocks.updateSort(createdSpaceId, createdBlockIds[0], {
  //       sort: 0,
  //     });
  //     const block = await client.blocks.getProperties(createdSpaceId, createdBlockIds[0]);
  //     expect(block.sort).toBe(0);
  //   });
  // });
});


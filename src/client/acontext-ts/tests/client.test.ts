/**
 * Unit tests for the Acontext TypeScript SDK.
 * These tests use mock data and do not require a running API server.
 */

import { MessagePart, FileUpload, buildAcontextMessage } from '../src/index';
import {
  createMockClient,
  MockAcontextClient,
  mockSpace,
  mockSession,
  mockMessage,
  mockGetMessagesOutput,
  mockDisk,
  mockArtifact,
  mockGetArtifactResp,
  mockFileContent,
  mockUser,
  mockTask,
  mockPaginatedList,
  resetMockIds,
} from './mocks';

describe('AcontextClient Unit Tests', () => {
  let client: MockAcontextClient;

  beforeEach(() => {
    client = createMockClient();
    resetMockIds();
  });

  afterEach(() => {
    client.reset();
  });

  describe('Health Check', () => {
    test('should ping the server', async () => {
      const result = await client.ping();
      expect(result).toBe('pong');
    });
  });

  describe('Spaces API', () => {
    test('should list spaces', async () => {
      const spaces = [mockSpace({ configs: { name: 'Space 1' } }), mockSpace({ configs: { name: 'Space 2' } })];
      client.mock().onGet('/space', () => mockPaginatedList(spaces, false));

      const result = await client.spaces.list();
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBe(2);
      expect(result.has_more).toBe(false);
    });

    test('should list spaces with pagination options', async () => {
      const spaces = [mockSpace()];
      client.mock().onGet('/space', (options) => {
        expect(options?.params?.limit).toBe(10);
        expect(options?.params?.time_desc).toBe('true');
        return mockPaginatedList(spaces, true, 'next-cursor');
      });

      const result = await client.spaces.list({ limit: 10, timeDesc: true });
      expect(result.items.length).toBe(1);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe('next-cursor');
    });

    test('should create a space', async () => {
      const createdSpace = mockSpace({ configs: { name: 'Test Space' } });
      client.mock().onPost('/space', (options) => {
        expect(options?.jsonData).toEqual({ configs: { name: 'Test Space' } });
        return createdSpace;
      });

      const space = await client.spaces.create({
        configs: { name: 'Test Space' },
      });
      expect(space).toBeDefined();
      expect(space.id).toBeDefined();
      expect(space.project_id).toBeDefined();
      expect(space.configs).toEqual({ name: 'Test Space' });
    });

    test('should create a space with user identifier', async () => {
      const createdSpace = mockSpace({
        configs: { name: 'User Space' },
      });
      // Set user_id directly
      (createdSpace as Record<string, unknown>).user_id = 'user@test.com';
      client.mock().onPost('/space', (options) => {
        const data = options?.jsonData as Record<string, unknown>;
        expect(data?.configs).toEqual({ name: 'User Space' });
        expect(data?.user).toBe('user@test.com');
        return createdSpace;
      });

      const space = await client.spaces.create({
        configs: { name: 'User Space' },
        user: 'user@test.com',
      });
      expect(space.user_id).toBe('user@test.com');
    });

    test('should get space configs', async () => {
      const spaceId = 'test-space-id';
      const space = mockSpace({ id: spaceId, configs: { name: 'Test Space' } });
      client.mock().onGet(`/space/${spaceId}/configs`, () => space);

      const result = await client.spaces.getConfigs(spaceId);
      expect(result).toBeDefined();
      expect(result.id).toBe(spaceId);
      expect(result.configs).toEqual({ name: 'Test Space' });
    });

    test('should update space configs', async () => {
      const spaceId = 'test-space-id';
      client.mock().onPut(`/space/${spaceId}/configs`, (options) => {
        expect(options?.jsonData).toEqual({
          configs: { name: 'Updated Test Space', test: true },
        });
        return undefined;
      });

      await client.spaces.updateConfigs(spaceId, {
        configs: { name: 'Updated Test Space', test: true },
      });

      // Verify the call was made
      expect(client.requester.calls).toHaveLength(1);
      expect(client.requester.calls[0].method).toBe('PUT');
    });

    test('should delete a space', async () => {
      const spaceId = 'test-space-id';
      client.mock().onDelete(`/space/${spaceId}`, () => undefined);

      await client.spaces.delete(spaceId);
      expect(client.requester.calls).toHaveLength(1);
      expect(client.requester.calls[0].method).toBe('DELETE');
      expect(client.requester.calls[0].path).toBe(`/space/${spaceId}`);
    });

    test('should perform experience search', async () => {
      const spaceId = 'test-space-id';
      const searchResult = {
        cited_blocks: [],
        final_answer: 'Test answer',
      };
      client.mock().onGet(/^\/space\/.*\/experience_search$/, (options) => {
        expect(options?.params?.query).toBe('test query');
        expect(options?.params?.limit).toBe(5);
        expect(options?.params?.mode).toBe('fast');
        return searchResult;
      });

      const result = await client.spaces.experienceSearch(spaceId, {
        query: 'test query',
        limit: 5,
        mode: 'fast',
      });
      expect(result).toBeDefined();
      expect(result.cited_blocks).toBeInstanceOf(Array);
      expect(result.final_answer).toBe('Test answer');
    });
  });

  describe('Sessions API', () => {
    test('should list sessions', async () => {
      const sessions = [mockSession(), mockSession()];
      client.mock().onGet('/session', () => mockPaginatedList(sessions, false));

      const result = await client.sessions.list();
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBe(2);
      expect(result.has_more).toBe(false);
    });

    test('should create a session', async () => {
      const spaceId = 'test-space-id';
      const createdSession = mockSession({
        space_id: spaceId,
        configs: { mode: 'test' },
      });
      client.mock().onPost('/session', (options) => {
        expect(options?.jsonData).toEqual({
          space_id: spaceId,
          configs: { mode: 'test' },
        });
        return createdSession;
      });

      const session = await client.sessions.create({
        spaceId: spaceId,
        configs: { mode: 'test' },
      });
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.space_id).toBe(spaceId);
    });

    test('should store a message in acontext format', async () => {
      const sessionId = 'test-session-id';
      const storedMessage = mockMessage({
        session_id: sessionId,
        role: 'user',
        parts: [{ type: 'text', text: 'Hello from TypeScript!' }],
      });
      client.mock().onPost(`/session/${sessionId}/messages`, (options) => {
        const data = options?.jsonData as Record<string, unknown>;
        expect(data?.format).toBe('acontext');
        return storedMessage;
      });

      const message = await client.sessions.storeMessage(
        sessionId,
        {
          role: 'user',
          parts: [MessagePart.textPart('Hello from TypeScript!')],
        },
        { format: 'acontext' }
      );
      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.session_id).toBe(sessionId);
      expect(message.role).toBe('user');
    });

    test('should store a message in openai format', async () => {
      const sessionId = 'test-session-id';
      const storedMessage = mockMessage({
        session_id: sessionId,
        role: 'user',
      });
      client.mock().onPost(`/session/${sessionId}/messages`, (options) => {
        const data = options?.jsonData as Record<string, unknown>;
        expect(data?.format).toBe('openai');
        expect(data?.blob).toEqual({
          role: 'user',
          content: 'Hello, how are you?',
        });
        return storedMessage;
      });

      const message = await client.sessions.storeMessage(
        sessionId,
        { role: 'user', content: 'Hello, how are you?' },
        { format: 'openai' }
      );
      expect(message).toBeDefined();
      expect(message.role).toBe('user');
    });

    test('should store message with file upload', async () => {
      const sessionId = 'test-session-id';
      const storedMessage = mockMessage({ session_id: sessionId });
      client.mock().onPost(`/session/${sessionId}/messages`, (options) => {
        expect(options?.files).toBeDefined();
        expect(options?.files?.test_file).toBeDefined();
        return storedMessage;
      });

      const fileField = 'test_file';
      const blob = buildAcontextMessage({
        role: 'user',
        parts: [MessagePart.fileFieldPart(fileField)],
      });
      const message = await client.sessions.storeMessage(sessionId, blob, {
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

    test('should get messages', async () => {
      const sessionId = 'test-session-id';
      const messageId = 'msg-1';
      client.mock().onGet(`/session/${sessionId}/messages`, () =>
        mockGetMessagesOutput({
          items: [{ role: 'user', content: 'Hello' }],
          ids: [messageId],
          has_more: false,
          this_time_tokens: 10,
        })
      );

      const result = await client.sessions.getMessages(sessionId, {
        format: 'acontext',
      });
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.has_more).toBe(false);
    });

    test('should get messages with edit strategies', async () => {
      const sessionId = 'test-session-id';
      const messageId = 'msg-1';
      client.mock().onGet(`/session/${sessionId}/messages`, (options) => {
        expect(options?.params?.edit_strategies).toBeDefined();
        const strategies = JSON.parse(options?.params?.edit_strategies as string);
        expect(strategies[0].type).toBe('remove_tool_result');
        return mockGetMessagesOutput({
          items: [{ role: 'user', content: 'Hello' }],
          ids: [messageId],
          has_more: false,
          this_time_tokens: 10,
        });
      });

      const editStrategies = [
        { type: 'remove_tool_result' as const, params: { keep_recent_n_tool_results: 3 } },
      ];
      const result = await client.sessions.getMessages(sessionId, {
        format: 'openai',
        editStrategies,
      });
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });

    test('should get tasks', async () => {
      const sessionId = 'test-session-id';
      const tasks = [mockTask({ session_id: sessionId })];
      client.mock().onGet(`/session/${sessionId}/task`, () =>
        mockPaginatedList(tasks, false)
      );

      const result = await client.sessions.getTasks(sessionId);
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.has_more).toBeDefined();
    });

    test('should get learning status', async () => {
      const sessionId = 'test-session-id';
      const learningStatus = {
        space_digested_count: 5,
        not_space_digested_count: 3,
      };
      client.mock().onGet(`/session/${sessionId}/get_learning_status`, () => learningStatus);

      const result = await client.sessions.getLearningStatus(sessionId);
      expect(result).toBeDefined();
      expect(result.space_digested_count).toBe(5);
      expect(result.not_space_digested_count).toBe(3);
    });

    test('should get token counts', async () => {
      const sessionId = 'test-session-id';
      const tokenCounts = { total_tokens: 1234 };
      client.mock().onGet(`/session/${sessionId}/token_counts`, () => tokenCounts);

      const result = await client.sessions.getTokenCounts(sessionId);
      expect(result).toBeDefined();
      expect(result.total_tokens).toBe(1234);
    });

    test('should update session configs', async () => {
      const sessionId = 'test-session-id';
      client.mock().onPut(`/session/${sessionId}/configs`, (options) => {
        expect(options?.jsonData).toEqual({ configs: { mode: 'test-updated' } });
        return undefined;
      });

      await client.sessions.updateConfigs(sessionId, {
        configs: { mode: 'test-updated' },
      });
      expect(client.requester.calls).toHaveLength(1);
    });

    test('should delete a session', async () => {
      const sessionId = 'test-session-id';
      client.mock().onDelete(`/session/${sessionId}`, () => undefined);

      await client.sessions.delete(sessionId);
      expect(client.requester.calls).toHaveLength(1);
      expect(client.requester.calls[0].method).toBe('DELETE');
    });

    test('should store Anthropic response format messages', async () => {
      const sessionId = 'test-session-id';
      const storedMessage = mockMessage({
        session_id: sessionId,
        role: 'assistant',
      });
      client.mock().onPost(`/session/${sessionId}/messages`, (options) => {
        const data = options?.jsonData as Record<string, unknown>;
        expect(data?.format).toBe('openai');
        return storedMessage;
      });

      // Simulate Anthropic API response format
      const anthropicResponse = {
        id: 'msg_01XFDUDYJgAACzvnptvVoYEL',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          {
            type: 'text',
            text: "Hello! I'm doing well, thank you for asking.",
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      const message = await client.sessions.storeMessage(
        sessionId,
        anthropicResponse,
        { format: 'openai' }
      );
      expect(message).toBeDefined();
      expect(message.role).toBe('assistant');
    });
  });

  describe('Disks API', () => {
    test('should list disks', async () => {
      const disks = [mockDisk(), mockDisk()];
      client.mock().onGet('/disk', () => mockPaginatedList(disks, false));

      const result = await client.disks.list();
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBe(2);
      expect(result.has_more).toBe(false);
    });

    test('should create a disk', async () => {
      const createdDisk = mockDisk();
      client.mock().onPost('/disk', () => createdDisk);

      const disk = await client.disks.create();
      expect(disk).toBeDefined();
      expect(disk.id).toBeDefined();
      expect(disk.project_id).toBeDefined();
    });

    test('should delete a disk', async () => {
      const diskId = 'test-disk-id';
      client.mock().onDelete(`/disk/${diskId}`, () => undefined);

      await client.disks.delete(diskId);
      expect(client.requester.calls).toHaveLength(1);
      expect(client.requester.calls[0].method).toBe('DELETE');
    });

    test('should upsert an artifact', async () => {
      const diskId = 'test-disk-id';
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/',
        filename: 'test.txt',
        meta: { source: 'test' },
      });
      client.mock().onPost(`/disk/${diskId}/artifact`, (options) => {
        expect(options?.files?.file).toBeDefined();
        expect(options?.data?.file_path).toBe('/');
        return artifact;
      });

      const result = await client.disks.artifacts.upsert(diskId, {
        file: new FileUpload({
          filename: 'test.txt',
          content: Buffer.from('Hello, World!'),
          contentType: 'text/plain',
        }),
        filePath: '/',
        meta: { source: 'test' },
      });
      expect(result).toBeDefined();
      expect(result.disk_id).toBe(diskId);
      expect(result.filename).toBe('test.txt');
    });

    test('should get an artifact', async () => {
      const diskId = 'test-disk-id';
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/',
        filename: 'test.txt',
      });
      client.mock().onGet(`/disk/${diskId}/artifact`, (options) => {
        expect(options?.params?.file_path).toBe('/test.txt');
        return mockGetArtifactResp({
          artifact,
          public_url: 'https://example.com/test.txt',
          content: mockFileContent({ raw: 'Hello!' }),
        });
      });

      const result = await client.disks.artifacts.get(diskId, {
        filePath: '/',
        filename: 'test.txt',
        withPublicUrl: true,
        withContent: true,
      });
      expect(result).toBeDefined();
      expect(result.artifact).toBeDefined();
      expect(result.artifact.filename).toBe('test.txt');
    });

    test('should update an artifact', async () => {
      const diskId = 'test-disk-id';
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/',
        filename: 'test.txt',
        meta: { source: 'test', updated: true },
      });
      client.mock().onPut(`/disk/${diskId}/artifact`, (options) => {
        expect(options?.jsonData).toMatchObject({
          file_path: '/test.txt',
        });
        return { artifact };
      });

      const result = await client.disks.artifacts.update(diskId, {
        filePath: '/',
        filename: 'test.txt',
        meta: { source: 'test', updated: true },
      });
      expect(result).toBeDefined();
      expect(result.artifact.meta).toMatchObject({ source: 'test', updated: true });
    });

    test('should list artifacts', async () => {
      const diskId = 'test-disk-id';
      const artifacts = [mockArtifact({ disk_id: diskId, path: '/' })];
      client.mock().onGet(`/disk/${diskId}/artifact/ls`, (options) => {
        expect(options?.params?.path).toBe('/');
        return { artifacts, directories: [] };
      });

      const result = await client.disks.artifacts.list(diskId, { path: '/' });
      expect(result).toBeDefined();
      expect(result.artifacts).toBeInstanceOf(Array);
      expect(result.directories).toBeInstanceOf(Array);
    });

    test('should delete an artifact', async () => {
      const diskId = 'test-disk-id';
      client.mock().onDelete(`/disk/${diskId}/artifact`, (options) => {
        expect(options?.params?.file_path).toBe('/test.txt');
        return undefined;
      });

      await client.disks.artifacts.delete(diskId, {
        filePath: '/',
        filename: 'test.txt',
      });
      expect(client.requester.calls).toHaveLength(1);
    });
  });

  describe('Users API', () => {
    test('should list users', async () => {
      const users = [mockUser(), mockUser()];
      client.mock().onGet('/user/ls', () => mockPaginatedList(users, false));

      const result = await client.users.list();
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBe(2);
      expect(result.has_more).toBe(false);
    });

    test('should list users with pagination options', async () => {
      const users = [mockUser()];
      client.mock().onGet('/user/ls', (options) => {
        expect(options?.params?.limit).toBe(10);
        expect(options?.params?.time_desc).toBe('true');
        return mockPaginatedList(users, false);
      });

      const result = await client.users.list({ limit: 10, timeDesc: true });
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });

    test('should get user resources', async () => {
      const identifier = 'user@test.com';
      const resources = {
        counts: {
          spaces_count: 5,
          sessions_count: 10,
          disks_count: 3,
          skills_count: 2,
        },
      };
      client
        .mock()
        .onGet(`/user/${encodeURIComponent(identifier)}/resources`, () => resources);

      const result = await client.users.getResources(identifier);
      expect(result).toBeDefined();
      expect(result.counts).toBeDefined();
      expect(result.counts.spaces_count).toBe(5);
      expect(result.counts.sessions_count).toBe(10);
      expect(result.counts.disks_count).toBe(3);
      expect(result.counts.skills_count).toBe(2);
    });

    test('should delete a user', async () => {
      const identifier = 'user@test.com';
      client.mock().onDelete(`/user/${encodeURIComponent(identifier)}`, () => undefined);

      await client.users.delete(identifier);
      expect(client.requester.calls).toHaveLength(1);
      expect(client.requester.calls[0].method).toBe('DELETE');
    });
  });

  describe('Skills API', () => {
    test('should download skill to sandbox', async () => {
      const skillId = 'skill-123';
      const sandboxId = 'sandbox-456';
      const response = {
        success: true,
        dir_path: '/skills/my-skill',
      };

      client.mock().onPost(`/agent_skills/${skillId}/download_to_sandbox`, (options) => {
        expect(options?.jsonData).toEqual({ sandbox_id: sandboxId });
        return response;
      });

      const result = await client.skills.downloadToSandbox(skillId, {
        sandboxId: sandboxId,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.dir_path).toBe('/skills/my-skill');
      expect(client.requester.calls).toHaveLength(1);
      expect(client.requester.calls[0].method).toBe('POST');
      expect(client.requester.calls[0].path).toBe(`/agent_skills/${skillId}/download_to_sandbox`);
    });
  });

  describe('Message Building Utilities', () => {
    test('should create text parts correctly', () => {
      const part = MessagePart.textPart('Hello, World!');
      expect(part.type).toBe('text');
      expect(part.text).toBe('Hello, World!');
    });

    test('should create file field parts correctly', () => {
      const part = MessagePart.fileFieldPart('my_file');
      expect(part.type).toBe('file');
      expect(part.file_field).toBe('my_file');
    });

    test('should build acontext message', () => {
      const message = buildAcontextMessage({
        role: 'user',
        parts: [MessagePart.textPart('Test message')],
      });
      expect(message).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.parts).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when no mock handler found', async () => {
      await expect(client.spaces.list()).rejects.toThrow(
        'No mock handler found for GET /space'
      );
    });
  });
});

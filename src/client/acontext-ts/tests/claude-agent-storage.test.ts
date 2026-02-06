/**
 * Unit tests for ClaudeAgentStorage integration.
 *
 * Tests conversion helpers, session id extraction, and the full
 * ClaudeAgentStorage class matching the Python integration 1:1.
 */

import { APIError } from '../src/errors';
import {
  ClaudeAgentStorage,
  ClaudeAgentStorageOptions,
  AcontextClientLike,
  claudeUserMessageToAnthropicBlob,
  claudeAssistantMessageToAnthropicBlob,
  getSessionIdFromMessage,
} from '../src/integrations/claude-agent';
import {
  createMockClient,
  MockAcontextClient,
  mockSession,
  mockMessage,
  resetMockIds,
} from './mocks';

// ---------------------------------------------------------------------------
// Test helpers – TS Claude Agent SDK message factories
// ---------------------------------------------------------------------------

/**
 * In the TS Claude Agent SDK, messages have a `type` field and nest the API
 * message object under `message`. These factories replicate that structure.
 */

const UUID_DEFAULT = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UUID_DISCOVERED = '44444444-4444-4444-4444-444444444444';
const UUID_FROM_RESULT = '55555555-5555-5555-5555-555555555555';
const UUID_FROM_STREAM = '66666666-6666-6666-6666-666666666666';
const UUID_FLOW = '77777777-7777-7777-7777-777777777777';
const UUID_FIRST = '88888888-8888-8888-8888-888888888888';
const UUID_SECOND = '99999999-9999-9999-9999-999999999999';

function systemInit(sessionId = UUID_DEFAULT): Record<string, unknown> {
  return { type: 'system', session_id: sessionId };
}

function systemOther(): Record<string, unknown> {
  return { type: 'system' };
}

function userMessage(text = 'Hello'): Record<string, unknown> {
  return {
    type: 'user',
    message: { role: 'user', content: text },
  };
}

function userBlockMessage(
  ...blocks: Array<Record<string, unknown>>
): Record<string, unknown> {
  return {
    type: 'user',
    message: { role: 'user', content: blocks },
  };
}

function userReplayMessage(text = 'Hello'): Record<string, unknown> {
  return {
    type: 'user',
    isReplay: true,
    message: { role: 'user', content: text },
  };
}

function assistantMessage(
  blocks: Array<Record<string, unknown>>,
  options?: { model?: string; error?: string }
): Record<string, unknown> {
  const model = options?.model ?? 'claude-sonnet-4-20250514';
  const msg: Record<string, unknown> = {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: blocks,
      model,
    },
  };
  if (options?.error !== undefined) {
    msg.error = options.error;
  }
  return msg;
}

function resultMessage(
  sessionId = UUID_DEFAULT
): Record<string, unknown> {
  return { type: 'result', session_id: sessionId };
}

function streamEvent(
  sessionId = UUID_DEFAULT
): Record<string, unknown> {
  return { type: 'stream_event', session_id: sessionId };
}

// Content blocks (TS SDK blocks have explicit `type` field)
const TEXT: Record<string, unknown> = { type: 'text', text: 'Hello, world!' };
const EMPTY_TEXT: Record<string, unknown> = { type: 'text', text: '' };
const THINKING: Record<string, unknown> = {
  type: 'thinking',
  thinking: 'Let me reason...',
  signature: 'sig123',
};
const EMPTY_THINKING: Record<string, unknown> = {
  type: 'thinking',
  thinking: '',
  signature: 'sig456',
};
const TOOL_USE: Record<string, unknown> = {
  type: 'tool_use',
  id: 'tu_1',
  name: 'calculator',
  input: { expr: '1+1' },
};
const TOOL_RESULT: Record<string, unknown> = {
  type: 'tool_result',
  tool_use_id: 'tu_1',
  content: 'Result is 2',
};
const TOOL_RESULT_ARRAY: Record<string, unknown> = {
  type: 'tool_result',
  tool_use_id: 'tu_2',
  content: [{ text: 'line1' }, { text: 'line2' }],
};
const TOOL_RESULT_NULL: Record<string, unknown> = {
  type: 'tool_result',
  tool_use_id: 'tu_3',
  content: null,
};
const TOOL_RESULT_ERROR: Record<string, unknown> = {
  type: 'tool_result',
  tool_use_id: 'tu_4',
  content: 'error detail',
  is_error: true,
};

// ---------------------------------------------------------------------------
// Helper to set up MockAcontextClient for ClaudeAgentStorage tests
// ---------------------------------------------------------------------------

function setupMockClient(): {
  client: MockAcontextClient;
  storeCalls: Array<{ sessionId: string; blob: unknown; options: unknown }>;
  createCalls: Array<{ options: unknown }>;
} {
  const client = createMockClient();
  const storeCalls: Array<{
    sessionId: string;
    blob: unknown;
    options: unknown;
  }> = [];
  const createCalls: Array<{ options: unknown }> = [];

  // Mock session creation
  client.mock().onPost(/^\/session$/, (opts) => {
    createCalls.push({ options: opts?.jsonData });
    const useUuid = (opts?.jsonData as Record<string, unknown>)?.use_uuid;
    return mockSession({ id: (useUuid as string) || 'auto-generated-uuid' });
  });

  // Mock store message
  client.mock().onPost(/^\/session\/[^/]+\/messages$/, (opts) => {
    // Extract sessionId from the call path recorded in the requester
    const lastCall = client.mock().calls[client.mock().calls.length - 1];
    const pathMatch = lastCall.path.match(/^\/session\/([^/]+)\/messages$/);
    const sessionId = pathMatch ? pathMatch[1] : 'unknown';
    storeCalls.push({
      sessionId,
      blob: (opts?.jsonData as Record<string, unknown>)?.blob,
      options: opts?.jsonData,
    });
    return mockMessage();
  });

  return { client, storeCalls, createCalls };
}

// ===================================================================
// 1. Conversion helpers – user message
// ===================================================================

describe('User message conversion (claudeUserMessageToAnthropicBlob)', () => {
  test('string content → text block', () => {
    const blob = claudeUserMessageToAnthropicBlob(userMessage('Hi'));
    expect(blob).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'Hi' }],
    });
  });

  test('empty string content → null', () => {
    expect(claudeUserMessageToAnthropicBlob(userMessage(''))).toBeNull();
  });

  test('text block', () => {
    const blob = claudeUserMessageToAnthropicBlob(userBlockMessage(TEXT));
    expect(blob).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'Hello, world!' }],
    });
  });

  test('empty text block → null', () => {
    expect(
      claudeUserMessageToAnthropicBlob(userBlockMessage(EMPTY_TEXT))
    ).toBeNull();
  });

  test('tool_result block', () => {
    const blob = claudeUserMessageToAnthropicBlob(
      userBlockMessage(TOOL_RESULT)
    );
    expect(blob).not.toBeNull();
    expect(blob!.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'tu_1',
        content: 'Result is 2',
      },
    ]);
  });

  test('tool_result with array content', () => {
    const blob = claudeUserMessageToAnthropicBlob(
      userBlockMessage(TOOL_RESULT_ARRAY)
    );
    expect(blob).not.toBeNull();
    expect((blob!.content as Array<Record<string, unknown>>)[0].content).toEqual([
      { type: 'text', text: 'line1' },
      { type: 'text', text: 'line2' },
    ]);
  });

  test('tool_result with null content → normalized to ""', () => {
    const blob = claudeUserMessageToAnthropicBlob(
      userBlockMessage(TOOL_RESULT_NULL)
    );
    expect(blob).not.toBeNull();
    expect((blob!.content as Array<Record<string, unknown>>)[0].content).toBe('');
  });

  test('tool_result with is_error', () => {
    const blob = claudeUserMessageToAnthropicBlob(
      userBlockMessage(TOOL_RESULT_ERROR)
    );
    expect(blob).not.toBeNull();
    const block = (blob!.content as Array<Record<string, unknown>>)[0];
    expect(block.is_error).toBe(true);
    expect(block.content).toBe('error detail');
  });

  test('tool_use in user → skipped', () => {
    const blob = claudeUserMessageToAnthropicBlob(
      userBlockMessage(TOOL_USE, TEXT)
    );
    expect(blob).not.toBeNull();
    // Only the text block should survive
    expect((blob!.content as Array<unknown>).length).toBe(1);
    expect((blob!.content as Array<Record<string, unknown>>)[0].type).toBe('text');
  });

  test('only tool_use in user → null', () => {
    expect(
      claudeUserMessageToAnthropicBlob(userBlockMessage(TOOL_USE))
    ).toBeNull();
  });

  test('mixed blocks (text + tool_result)', () => {
    const blob = claudeUserMessageToAnthropicBlob(
      userBlockMessage(TEXT, TOOL_RESULT)
    );
    expect(blob).not.toBeNull();
    const content = blob!.content as Array<Record<string, unknown>>;
    expect(content.length).toBe(2);
    expect(content[0].type).toBe('text');
    expect(content[1].type).toBe('tool_result');
  });
});

// ===================================================================
// 2. Conversion helpers – assistant message
// ===================================================================

describe('Assistant message conversion (claudeAssistantMessageToAnthropicBlob)', () => {
  test('text block', () => {
    const { blob, hasThinking } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([TEXT])
    );
    expect(blob).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello, world!' }],
    });
    expect(hasThinking).toBe(false);
  });

  test('empty text block → null', () => {
    const { blob } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([EMPTY_TEXT])
    );
    expect(blob).toBeNull();
  });

  test('thinking omitted by default', () => {
    const { blob, hasThinking } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([THINKING, TEXT])
    );
    expect(blob).not.toBeNull();
    expect((blob!.content as Array<unknown>).length).toBe(1);
    expect((blob!.content as Array<Record<string, unknown>>)[0].type).toBe(
      'text'
    );
    expect(hasThinking).toBe(false);
  });

  test('thinking included when opted in', () => {
    const { blob, hasThinking } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([THINKING, TEXT]),
      true
    );
    expect(blob).not.toBeNull();
    expect((blob!.content as Array<unknown>).length).toBe(2);
    expect((blob!.content as Array<Record<string, unknown>>)[0]).toEqual({
      type: 'thinking',
      thinking: 'Let me reason...',
      signature: 'sig123',
    });
    expect(hasThinking).toBe(true);
  });

  test('empty thinking skipped even when opted in', () => {
    const { blob, hasThinking } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([EMPTY_THINKING, TEXT]),
      true
    );
    expect(blob).not.toBeNull();
    expect((blob!.content as Array<unknown>).length).toBe(1);
    expect(
      (blob!.content as Array<Record<string, unknown>>)[0].text
    ).toBe('Hello, world!');
    // Empty thinking was skipped, so no thinking was actually included
    expect(hasThinking).toBe(false);
  });

  test('only thinking with includeThinking=false → null', () => {
    const { blob } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([THINKING])
    );
    expect(blob).toBeNull();
  });

  test('tool_use block', () => {
    const { blob } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([TOOL_USE])
    );
    expect(blob).not.toBeNull();
    expect((blob!.content as Array<Record<string, unknown>>)[0]).toEqual({
      type: 'tool_use',
      id: 'tu_1',
      name: 'calculator',
      input: { expr: '1+1' },
    });
  });

  test('tool_use with string input (valid JSON) → parsed', () => {
    const toolUseStringInput = {
      type: 'tool_use',
      id: 'tu_5',
      name: 'calc',
      input: '{"expr":"2+2"}',
    };
    const { blob } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([toolUseStringInput])
    );
    expect(blob).not.toBeNull();
    expect(
      (blob!.content as Array<Record<string, unknown>>)[0].input
    ).toEqual({ expr: '2+2' });
  });

  test('tool_use with string input (invalid JSON) → wrapped as { raw: input }', () => {
    const toolUseInvalidJson = {
      type: 'tool_use',
      id: 'tu_6',
      name: 'calc',
      input: 'not json',
    };
    const { blob } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([toolUseInvalidJson])
    );
    expect(blob).not.toBeNull();
    expect(
      (blob!.content as Array<Record<string, unknown>>)[0].input
    ).toEqual({ raw: 'not json' });
  });

  test('tool_result in assistant → skipped', () => {
    const { blob } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([TOOL_RESULT, TEXT])
    );
    expect(blob).not.toBeNull();
    expect((blob!.content as Array<unknown>).length).toBe(1);
    expect((blob!.content as Array<Record<string, unknown>>)[0].type).toBe(
      'text'
    );
  });

  test('only tool_result in assistant → null', () => {
    const { blob } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([TOOL_RESULT])
    );
    expect(blob).toBeNull();
  });

  test('full message (thinking + text + tool_use) with includeThinking=true', () => {
    const { blob, hasThinking } = claudeAssistantMessageToAnthropicBlob(
      assistantMessage([THINKING, TEXT, TOOL_USE]),
      true
    );
    expect(blob).not.toBeNull();
    const content = blob!.content as Array<Record<string, unknown>>;
    expect(content.length).toBe(3);
    const types = content.map((b) => b.type);
    expect(types).toEqual(['thinking', 'text', 'tool_use']);
    expect(hasThinking).toBe(true);
  });
});

// ===================================================================
// 3. Session id extraction
// ===================================================================

describe('Session id extraction (getSessionIdFromMessage)', () => {
  test('system init with session_id', () => {
    expect(getSessionIdFromMessage(systemInit(UUID_DEFAULT))).toBe(UUID_DEFAULT);
  });

  test('system without session_id', () => {
    expect(getSessionIdFromMessage(systemOther())).toBeNull();
  });

  test('result message with session_id', () => {
    expect(getSessionIdFromMessage(resultMessage(UUID_FROM_RESULT))).toBe(UUID_FROM_RESULT);
  });

  test('stream event with session_id', () => {
    expect(getSessionIdFromMessage(streamEvent(UUID_FROM_STREAM))).toBe(UUID_FROM_STREAM);
  });

  test('user message → null', () => {
    expect(getSessionIdFromMessage(userMessage())).toBeNull();
  });

  test('assistant message → null', () => {
    expect(getSessionIdFromMessage(assistantMessage([TEXT]))).toBeNull();
  });

  test('message with non-string session_id → null', () => {
    expect(
      getSessionIdFromMessage({ type: 'system', session_id: 12345 })
    ).toBeNull();
  });

  test('non-UUID session_id → null', () => {
    expect(getSessionIdFromMessage(systemInit('not-a-uuid'))).toBeNull();
  });

  test('non-UUID result session_id → null', () => {
    expect(getSessionIdFromMessage(resultMessage('invalid'))).toBeNull();
  });

  test('non-UUID stream session_id → null', () => {
    expect(getSessionIdFromMessage(streamEvent('invalid'))).toBeNull();
  });
});

// ===================================================================
// 4. ClaudeAgentStorage – basic (sessionId provided)
// ===================================================================

describe('ClaudeAgentStorage – basic (sessionId provided)', () => {
  let client: MockAcontextClient;
  let storeCalls: Array<{
    sessionId: string;
    blob: unknown;
    options: unknown;
  }>;

  beforeEach(() => {
    const setup = setupMockClient();
    client = setup.client;
    storeCalls = setup.storeCalls;
    resetMockIds();
  });

  afterEach(() => {
    client.reset();
  });

  test('user message stored with correct blob and meta: null', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(userMessage('Hi'));

    expect(storeCalls.length).toBe(1);
    const call = storeCalls[0];
    expect(call.sessionId).toBe('sess-1');
    const opts = call.options as Record<string, unknown>;
    expect(opts.format).toBe('anthropic');
    expect(opts.blob).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'Hi' }],
    });
    // meta should be null for user messages
    expect(opts.meta).toBeUndefined();
  });

  test('assistant message stored with meta.model', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(
      assistantMessage([TEXT], { model: 'claude-sonnet-4-20250514' })
    );

    expect(storeCalls.length).toBe(1);
    const opts = storeCalls[0].options as Record<string, unknown>;
    expect((opts.blob as Record<string, unknown>).role).toBe('assistant');
    expect(opts.meta).toEqual({ model: 'claude-sonnet-4-20250514' });
  });

  test('assistant with thinking → meta.has_thinking', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
      includeThinking: true,
    });
    await storage.saveMessage(assistantMessage([THINKING, TEXT]));

    expect(storeCalls.length).toBe(1);
    const opts = storeCalls[0].options as Record<string, unknown>;
    const meta = opts.meta as Record<string, unknown>;
    expect(meta.has_thinking).toBe(true);
    expect(meta.model).toBe('claude-sonnet-4-20250514');
  });

  test('system message NOT stored', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(systemInit());

    expect(storeCalls.length).toBe(0);
  });

  test('result message NOT stored', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(resultMessage());

    expect(storeCalls.length).toBe(0);
  });

  test('stream event NOT stored', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(streamEvent());

    expect(storeCalls.length).toBe(0);
  });
});

// ===================================================================
// 5. ClaudeAgentStorage – session discovery
// ===================================================================

describe('ClaudeAgentStorage – session discovery', () => {
  let client: MockAcontextClient;
  let storeCalls: Array<{
    sessionId: string;
    blob: unknown;
    options: unknown;
  }>;
  let createCalls: Array<{ options: unknown }>;

  beforeEach(() => {
    const setup = setupMockClient();
    client = setup.client;
    storeCalls = setup.storeCalls;
    createCalls = setup.createCalls;
    resetMockIds();
  });

  afterEach(() => {
    client.reset();
  });

  test('session_id from system init → stored for subsequent messages', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    expect(storage.sessionId).toBeNull();

    await storage.saveMessage(systemInit(UUID_DISCOVERED));
    expect(storage.sessionId).toBe(UUID_DISCOVERED);

    await storage.saveMessage(userMessage('After init'));
    expect(storeCalls.length).toBe(1);
    expect(storeCalls[0].sessionId).toBe(UUID_DISCOVERED);
  });

  test('session_id from result message', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    await storage.saveMessage(resultMessage(UUID_FROM_RESULT));
    expect(storage.sessionId).toBe(UUID_FROM_RESULT);
  });

  test('session_id from stream event', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    await storage.saveMessage(streamEvent(UUID_FROM_STREAM));
    expect(storage.sessionId).toBe(UUID_FROM_STREAM);
  });

  test('user before session_id → _ensureSession creates session', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    await storage.saveMessage(userMessage('Before init'));

    expect(storeCalls.length).toBe(1);
    expect(storage.sessionId).not.toBeNull();
    expect(createCalls.length).toBe(1);
  });

  test('assistant before session_id → _ensureSession creates session', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    await storage.saveMessage(assistantMessage([TEXT]));

    expect(storeCalls.length).toBe(1);
    expect(storage.sessionId).not.toBeNull();
  });
});

// ===================================================================
// 6. ClaudeAgentStorage – errored messages
// ===================================================================

describe('ClaudeAgentStorage – errored messages', () => {
  let client: MockAcontextClient;
  let storeCalls: Array<{
    sessionId: string;
    blob: unknown;
    options: unknown;
  }>;

  beforeEach(() => {
    const setup = setupMockClient();
    client = setup.client;
    storeCalls = setup.storeCalls;
    resetMockIds();
  });

  afterEach(() => {
    client.reset();
  });

  test('errored assistant with valid content → stored, meta.error set', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(
      assistantMessage([TEXT], { error: 'rate_limit' })
    );

    expect(storeCalls.length).toBe(1);
    const opts = storeCalls[0].options as Record<string, unknown>;
    expect((opts.blob as Record<string, unknown>).role).toBe('assistant');
    expect((opts.meta as Record<string, unknown>).error).toBe('rate_limit');
  });

  test('errored assistant with empty content → naturally skipped', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(
      assistantMessage([EMPTY_TEXT], { error: 'server_error' })
    );

    expect(storeCalls.length).toBe(0);
  });
});

// ===================================================================
// 7. ClaudeAgentStorage – empty content
// ===================================================================

describe('ClaudeAgentStorage – empty content', () => {
  let client: MockAcontextClient;
  let storeCalls: Array<{
    sessionId: string;
    blob: unknown;
    options: unknown;
  }>;

  beforeEach(() => {
    const setup = setupMockClient();
    client = setup.client;
    storeCalls = setup.storeCalls;
    resetMockIds();
  });

  afterEach(() => {
    client.reset();
  });

  test('empty user string → NOT stored', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(userMessage(''));

    expect(storeCalls.length).toBe(0);
  });

  test('user with only empty text blocks → NOT stored', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(userBlockMessage(EMPTY_TEXT, EMPTY_TEXT));

    expect(storeCalls.length).toBe(0);
  });

  test('assistant with only thinking + includeThinking=false → NOT stored', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(assistantMessage([THINKING]));

    expect(storeCalls.length).toBe(0);
  });

  test('user with only tool_use blocks → NOT stored', async () => {
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(userBlockMessage(TOOL_USE));

    expect(storeCalls.length).toBe(0);
  });
});

// ===================================================================
// 8. ClaudeAgentStorage – error handling
// ===================================================================

describe('ClaudeAgentStorage – error handling', () => {
  test('default: exception logged via console.warn, not re-thrown', async () => {
    const client = createMockClient();
    resetMockIds();

    // Mock create to succeed
    client.mock().onPost(/^\/session$/, () => mockSession({ id: 'sess-1' }));
    // Mock store to throw
    client.mock().onPost(/^\/session\/[^/]+\/messages$/, () => {
      throw new Error('API down');
    });

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Should not throw
    await storage.saveMessage(userMessage('Hi'));

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('Failed to store message');
    warnSpy.mockRestore();
  });

  test('with onError: callback invoked with (Error, blob)', async () => {
    const client = createMockClient();
    resetMockIds();

    client.mock().onPost(/^\/session$/, () => mockSession({ id: 'sess-1' }));
    client.mock().onPost(/^\/session\/[^/]+\/messages$/, () => {
      throw new Error('API down');
    });

    const errors: Array<{ err: Error; blob: Record<string, unknown> }> = [];
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
      onError: (err, blob) => errors.push({ err, blob }),
    });

    await storage.saveMessage(userMessage('Hi'));

    expect(errors.length).toBe(1);
    expect(errors[0].err).toBeInstanceOf(Error);
    expect((errors[0].blob as Record<string, unknown>).role).toBe('user');
  });
});

// ===================================================================
// 9. ClaudeAgentStorage – session creation
// ===================================================================

describe('ClaudeAgentStorage – session creation', () => {
  test('session created on first store (with useUuid if set)', async () => {
    const { client, storeCalls, createCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(userMessage('Hi'));

    expect(createCalls.length).toBe(1);
    expect(
      (createCalls[0].options as Record<string, unknown>).use_uuid
    ).toBe('sess-1');
    expect(storeCalls.length).toBe(1);
  });

  test('session created only once (multiple stores)', async () => {
    const { client, storeCalls, createCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(userMessage('First'));
    await storage.saveMessage(userMessage('Second'));

    expect(createCalls.length).toBe(1);
    expect(storeCalls.length).toBe(2);
  });

  test('409 conflict handled gracefully', async () => {
    const client = createMockClient();
    resetMockIds();

    // Mock create to throw 409
    client.mock().onPost(/^\/session$/, () => {
      throw new APIError({ statusCode: 409, message: 'session already exists' });
    });
    client.mock().onPost(/^\/session\/[^/]+\/messages$/, () => mockMessage());

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });

    // Should not throw
    await storage.saveMessage(userMessage('Hi'));
    // store should still be called
    const storeCallCount = client
      .mock()
      .calls.filter((c) => c.method === 'POST' && c.path.includes('/messages'))
      .length;
    expect(storeCallCount).toBe(1);
  });

  test('non-409 error propagates to onError/console.warn', async () => {
    const client = createMockClient();
    resetMockIds();

    client.mock().onPost(/^\/session$/, () => {
      throw new APIError({
        statusCode: 500,
        message: 'internal server error',
      });
    });

    const errors: Array<{ err: Error; blob: Record<string, unknown> }> = [];
    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
      onError: (err, blob) => errors.push({ err, blob }),
    });
    await storage.saveMessage(userMessage('Hi'));

    expect(errors.length).toBe(1);
    expect(errors[0].err).toBeInstanceOf(APIError);
  });

  test('discovered session_id used as useUuid', async () => {
    const { client, storeCalls, createCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    await storage.saveMessage(systemInit(UUID_DISCOVERED));
    await storage.saveMessage(userMessage('Hi'));

    expect(createCalls.length).toBe(1);
    expect(
      (createCalls[0].options as Record<string, unknown>).use_uuid
    ).toBe(UUID_DISCOVERED);
  });

  test('no session_id → Acontext generates one', async () => {
    const { client, storeCalls, createCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    await storage.saveMessage(userMessage('Hi'));

    expect(createCalls.length).toBe(1);
    // use_uuid should not be present (SessionsAPI omits null values from payload)
    const createOpts = createCalls[0].options as
      | Record<string, unknown>
      | undefined;
    expect(createOpts?.use_uuid).toBeUndefined();
    expect(storage.sessionId).toBe('auto-generated-uuid');
    expect(storeCalls.length).toBe(1);
  });

  test('user parameter passed to create()', async () => {
    const { client, createCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
      user: 'alice@example.com',
    });
    await storage.saveMessage(userMessage('Hi'));

    expect(createCalls.length).toBe(1);
    expect(
      (createCalls[0].options as Record<string, unknown>).user
    ).toBe('alice@example.com');
  });
});

// ===================================================================
// 10. ClaudeAgentStorage – replay messages (TS-only)
// ===================================================================

describe('ClaudeAgentStorage – replay messages', () => {
  test('user message with isReplay: true → NOT stored', async () => {
    const { client, storeCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(userReplayMessage('Replayed'));

    expect(storeCalls.length).toBe(0);
  });
});

// ===================================================================
// 11. ClaudeAgentStorage – session_id not overwritten
// ===================================================================

describe('ClaudeAgentStorage – session_id not overwritten', () => {
  test('once set, not overwritten by later messages', async () => {
    const { client } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });
    await storage.saveMessage(systemInit(UUID_FIRST));
    expect(storage.sessionId).toBe(UUID_FIRST);

    await storage.saveMessage(resultMessage(UUID_SECOND));
    expect(storage.sessionId).toBe(UUID_FIRST); // not overwritten
  });

  test('explicit session_id not overwritten by stream', async () => {
    const { client } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'explicit',
    });
    await storage.saveMessage(systemInit(UUID_FROM_STREAM));
    expect(storage.sessionId).toBe('explicit');
  });
});

// ===================================================================
// 12. ClaudeAgentStorage – assistant meta edge cases
// ===================================================================

describe('ClaudeAgentStorage – assistant meta edge cases', () => {
  test('empty model string → not included in meta → meta is null', async () => {
    const { client, storeCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    await storage.saveMessage(assistantMessage([TEXT], { model: '' }));

    expect(storeCalls.length).toBe(1);
    const opts = storeCalls[0].options as Record<string, unknown>;
    // Empty model → not included in meta, meta empty → null
    expect(opts.meta).toBeUndefined();
  });

  test('no model, no thinking, no error → meta is null', async () => {
    const { client, storeCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      sessionId: 'sess-1',
    });
    // Craft assistant message with empty model, no error
    const msg: Record<string, unknown> = {
      type: 'assistant',
      message: { role: 'assistant', content: [TEXT], model: '' },
    };
    await storage.saveMessage(msg);

    expect(storeCalls.length).toBe(1);
    const opts = storeCalls[0].options as Record<string, unknown>;
    expect(opts.meta).toBeUndefined();
  });
});

// ===================================================================
// 13. ClaudeAgentStorage – full flow
// ===================================================================

describe('ClaudeAgentStorage – full flow', () => {
  test('init → user → stream → assistant → result', async () => {
    const { client, storeCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
    });

    // 1. System init → sets session_id, not stored
    await storage.saveMessage(systemInit(UUID_FLOW));
    expect(storage.sessionId).toBe(UUID_FLOW);
    expect(storeCalls.length).toBe(0);

    // 2. User message → stored
    await storage.saveMessage(userMessage('What is 1+1?'));
    expect(storeCalls.length).toBe(1);
    const userOpts = storeCalls[0].options as Record<string, unknown>;
    expect((userOpts.blob as Record<string, unknown>).role).toBe('user');

    // 3. Stream events → not stored
    await storage.saveMessage(streamEvent(UUID_FLOW));
    expect(storeCalls.length).toBe(1); // unchanged

    // 4. Assistant reply → stored
    await storage.saveMessage(
      assistantMessage([THINKING, TEXT, TOOL_USE], {
        model: 'claude-sonnet-4-20250514',
      })
    );
    expect(storeCalls.length).toBe(2);
    const assistOpts = storeCalls[1].options as Record<string, unknown>;
    const assistBlob = assistOpts.blob as Record<string, unknown>;
    expect(assistBlob.role).toBe('assistant');
    // Thinking omitted by default
    expect(
      (assistBlob.content as Array<Record<string, unknown>>).length
    ).toBe(2);
    expect(assistOpts.meta).toEqual({ model: 'claude-sonnet-4-20250514' });

    // 5. Result message → not stored
    await storage.saveMessage(resultMessage(UUID_FLOW));
    expect(storeCalls.length).toBe(2); // unchanged
  });

  test('init → assistant with thinking', async () => {
    const { client, storeCalls } = setupMockClient();
    resetMockIds();

    const storage = new ClaudeAgentStorage({
      client: client as unknown as AcontextClientLike,
      includeThinking: true,
    });

    await storage.saveMessage(systemInit(UUID_FLOW));
    await storage.saveMessage(
      assistantMessage([THINKING, TEXT], {
        model: 'claude-sonnet-4-20250514',
      })
    );

    expect(storeCalls.length).toBe(1);
    const opts = storeCalls[0].options as Record<string, unknown>;
    const blob = opts.blob as Record<string, unknown>;
    expect((blob.content as Array<unknown>).length).toBe(2);
    const meta = opts.meta as Record<string, unknown>;
    expect(meta.has_thinking).toBe(true);
    expect(meta.model).toBe('claude-sonnet-4-20250514');
  });
});

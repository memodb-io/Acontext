/**
 * Mock utilities for testing the Acontext TypeScript SDK.
 * These mocks allow unit testing without a running API server.
 */

import { RequesterProtocol } from '../src/client-types';
import { SessionsAPI } from '../src/resources/sessions';
import { DisksAPI } from '../src/resources/disks';
import { SkillsAPI } from '../src/resources/skills';
import { ToolsAPI } from '../src/resources/tools';
import { UsersAPI } from '../src/resources/users';

// Type for mock response handlers
type MockHandler = (options?: {
  params?: Record<string, string | number>;
  jsonData?: unknown;
  data?: Record<string, string>;
  files?: Record<string, { filename: string; content: Buffer | NodeJS.ReadableStream; contentType: string }>;
  unwrap?: boolean;
}) => unknown;

export interface MockRoute {
  method: string;
  path: string | RegExp;
  handler: MockHandler;
}

/**
 * Mock implementation of RequesterProtocol for testing.
 */
export class MockRequester implements RequesterProtocol {
  private routes: MockRoute[] = [];
  public calls: Array<{
    method: string;
    path: string;
    options?: Record<string, unknown>;
  }> = [];

  /**
   * Register a mock route handler.
   */
  on(method: string, path: string | RegExp, handler: MockHandler): this {
    this.routes.push({ method, path, handler });
    return this;
  }

  /**
   * Convenience methods for common HTTP methods.
   */
  onGet(path: string | RegExp, handler: MockHandler): this {
    return this.on('GET', path, handler);
  }

  onPost(path: string | RegExp, handler: MockHandler): this {
    return this.on('POST', path, handler);
  }

  onPut(path: string | RegExp, handler: MockHandler): this {
    return this.on('PUT', path, handler);
  }

  onDelete(path: string | RegExp, handler: MockHandler): this {
    return this.on('DELETE', path, handler);
  }

  onPatch(path: string | RegExp, handler: MockHandler): this {
    return this.on('PATCH', path, handler);
  }

  /**
   * Clear all registered routes.
   */
  reset(): void {
    this.routes = [];
    this.calls = [];
  }

  /**
   * Implementation of RequesterProtocol.request().
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | number>;
      jsonData?: unknown;
      data?: Record<string, string>;
      files?: Record<string, { filename: string; content: Buffer | NodeJS.ReadableStream; contentType: string }>;
      unwrap?: boolean;
    }
  ): Promise<T> {
    // Record the call
    this.calls.push({ method, path, options });

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const matches =
        typeof route.path === 'string'
          ? route.path === path
          : route.path.test(path);

      if (matches) {
        return route.handler(options) as T;
      }
    }

    throw new Error(`No mock handler found for ${method} ${path}`);
  }
}

/**
 * Mock client that uses MockRequester internally.
 * Provides the same API as AcontextClient but with mock data.
 */
export class MockAcontextClient {
  public requester: MockRequester;
  public sessions: SessionsAPI;
  public disks: DisksAPI;
  public artifacts: DisksAPI['artifacts'];
  public skills: SkillsAPI;
  public tools: ToolsAPI;
  public users: UsersAPI;

  constructor() {
    this.requester = new MockRequester();
    this.sessions = new SessionsAPI(this.requester);
    this.disks = new DisksAPI(this.requester);
    this.artifacts = this.disks.artifacts;
    this.skills = new SkillsAPI(this.requester);
    this.tools = new ToolsAPI(this.requester);
    this.users = new UsersAPI(this.requester);
  }

  /**
   * Mock the ping endpoint.
   */
  async ping(): Promise<string> {
    return 'pong';
  }

  /**
   * Access the underlying mock requester to register handlers.
   */
  mock(): MockRequester {
    return this.requester;
  }

  /**
   * Reset all mock handlers.
   */
  reset(): void {
    this.requester.reset();
  }
}

/**
 * Factory function to create a new mock client.
 */
export function createMockClient(): MockAcontextClient {
  return new MockAcontextClient();
}

// ============================================
// Mock Data Generators
// ============================================

let mockIdCounter = 0;

/**
 * Generate a mock UUID.
 */
export function mockId(): string {
  mockIdCounter++;
  return `mock-uuid-${mockIdCounter.toString().padStart(8, '0')}`;
}

/**
 * Reset the mock ID counter.
 */
export function resetMockIds(): void {
  mockIdCounter = 0;
}

/**
 * Generate a mock timestamp.
 */
export function mockTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Mock data factory for Session objects.
 */
export function mockSession(overrides?: Partial<{
  id: string;
  project_id: string;
  user_id: string | null;
  disable_task_tracking: boolean;
  configs: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    project_id: overrides?.project_id ?? mockId(),
    user_id: overrides?.user_id ?? null,
    disable_task_tracking: overrides?.disable_task_tracking ?? false,
    configs: overrides?.configs ?? {},
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

/**
 * Mock data factory for Message objects.
 */
export function mockMessage(overrides?: Partial<{
  id: string;
  session_id: string;
  parent_id: string | null;
  role: string;
  meta: Record<string, unknown>;
  parts: Array<Record<string, unknown>>;
  task_id: string | null;
  session_task_process_status: string;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    session_id: overrides?.session_id ?? mockId(),
    parent_id: overrides?.parent_id ?? null,
    role: overrides?.role ?? 'user',
    meta: overrides?.meta ?? {},
    parts: overrides?.parts ?? [{ type: 'text', text: 'Hello' }],
    task_id: overrides?.task_id ?? null,
    session_task_process_status: overrides?.session_task_process_status ?? 'pending',
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

/**
 * Mock data factory for GetMessagesOutput.
 */
export function mockGetMessagesOutput(overrides?: Partial<{
  items: Array<unknown>;
  ids: string[];
  metas: Array<Record<string, unknown>>;
  next_cursor: string | null;
  has_more: boolean;
  this_time_tokens: number;
  public_urls: Record<string, { url: string; expire_at: string }> | null;
  edit_at_message_id: string | null;
}>): Record<string, unknown> {
  return {
    items: overrides?.items ?? [],
    ids: overrides?.ids ?? [],
    metas: overrides?.metas ?? [],
    next_cursor: overrides?.next_cursor ?? null,
    has_more: overrides?.has_more ?? false,
    this_time_tokens: overrides?.this_time_tokens ?? 0,
    public_urls: overrides?.public_urls ?? null,
    edit_at_message_id: overrides?.edit_at_message_id ?? null,
  };
}

/**
 * Mock data factory for Disk objects.
 */
export function mockDisk(overrides?: Partial<{
  id: string;
  project_id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    project_id: overrides?.project_id ?? mockId(),
    user_id: overrides?.user_id ?? null,
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

/**
 * Mock data factory for Artifact objects.
 */
export function mockArtifact(overrides?: Partial<{
  disk_id: string;
  path: string;
  filename: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    disk_id: overrides?.disk_id ?? mockId(),
    path: overrides?.path ?? '/',
    filename: overrides?.filename ?? 'test.txt',
    meta: overrides?.meta ?? {},
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

/**
 * Mock data factory for FileContent objects.
 */
export function mockFileContent(overrides?: Partial<{
  type: string;
  raw: string;
}>): Record<string, unknown> {
  return {
    type: overrides?.type ?? 'text',
    raw: overrides?.raw ?? 'Hello, World!',
  };
}

/**
 * Mock data factory for GetArtifactResp objects.
 */
export function mockGetArtifactResp(overrides?: Partial<{
  artifact: Record<string, unknown>;
  public_url: string | null;
  content: Record<string, unknown> | null;
}>): Record<string, unknown> {
  return {
    artifact: overrides?.artifact ?? mockArtifact(),
    public_url: overrides?.public_url ?? null,
    content: overrides?.content ?? mockFileContent(),
  };
}

/**
 * Mock data factory for User objects.
 */
export function mockUser(overrides?: Partial<{
  id: string;
  project_id: string;
  identifier: string;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    project_id: overrides?.project_id ?? mockId(),
    identifier: overrides?.identifier ?? `user-${mockId()}@test.com`,
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

/**
 * Mock data factory for Task objects.
 */
export function mockTask(overrides?: Partial<{
  id: string;
  session_id: string;
  project_id: string;
  order: number;
  data: Record<string, unknown>;
  status: string;
  is_planning: boolean;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    session_id: overrides?.session_id ?? mockId(),
    project_id: overrides?.project_id ?? mockId(),
    order: overrides?.order ?? 1,
    data: overrides?.data ?? {
      task_description: 'Test task',
      progresses: [],
      user_preferences: [],
    },
    status: overrides?.status ?? 'pending',
    is_planning: overrides?.is_planning ?? false,
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

/**
 * Helper to create a paginated list response.
 */
export function mockPaginatedList<T>(
  items: T[],
  hasMore = false,
  nextCursor?: string
): { items: T[]; has_more: boolean; next_cursor?: string } {
  const result: { items: T[]; has_more: boolean; next_cursor?: string } = {
    items,
    has_more: hasMore,
  };
  if (nextCursor) {
    result.next_cursor = nextCursor;
  }
  return result;
}

/**
 * Mock data factory for Skill objects.
 */
export function mockSkill(overrides?: Partial<{
  id: string;
  name: string;
  description: string;
  disk_id: string;
  file_index: Array<{ path: string; mime: string }>;
  meta: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    name: overrides?.name ?? 'test-skill',
    description: overrides?.description ?? 'A test skill',
    disk_id: overrides?.disk_id ?? mockId(),
    file_index: overrides?.file_index ?? [],
    meta: overrides?.meta ?? null,
    user_id: overrides?.user_id ?? null,
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

/**
 * Mock data factory for Tool objects.
 */
export function mockTool(overrides?: Partial<{
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  description: string;
  config: Record<string, unknown> | null;
  schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    project_id: overrides?.project_id ?? mockId(),
    user_id: overrides?.user_id ?? null,
    name: overrides?.name ?? 'github_search',
    description: overrides?.description ?? 'Search GitHub',
    config: overrides?.config ?? { tag: 'web' },
    schema: overrides?.schema ?? {
      type: 'function',
      function: {
        name: overrides?.name ?? 'github_search',
        description: overrides?.description ?? 'Search GitHub',
        parameters: { type: 'object', properties: {} },
      },
    },
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

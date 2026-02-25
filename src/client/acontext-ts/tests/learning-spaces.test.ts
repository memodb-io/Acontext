/**
 * Unit tests for the LearningSpacesAPI resource.
 */

import { LearningSpacesAPI } from '../src/resources/learning-spaces';
import { TimeoutError } from '../src/errors';
import {
  createMockClient,
  MockAcontextClient,
  mockId,
  mockTimestamp,
  mockSkill,
  mockPaginatedList,
  resetMockIds,
} from './mocks';

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function mockLearningSpace(
  overrides?: Partial<{
    id: string;
    user_id: string | null;
    meta: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  }>
): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    user_id: overrides?.user_id ?? null,
    meta: overrides?.meta ?? { version: '1.0' },
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

function mockLearningSpaceSession(
  overrides?: Partial<{
    id: string;
    learning_space_id: string;
    session_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>
): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    learning_space_id: overrides?.learning_space_id ?? mockId(),
    session_id: overrides?.session_id ?? mockId(),
    status: overrides?.status ?? 'pending',
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

function mockLearningSpaceSkill(
  overrides?: Partial<{
    id: string;
    learning_space_id: string;
    skill_id: string;
    created_at: string;
  }>
): Record<string, unknown> {
  const now = mockTimestamp();
  return {
    id: overrides?.id ?? mockId(),
    learning_space_id: overrides?.learning_space_id ?? mockId(),
    skill_id: overrides?.skill_id ?? mockId(),
    created_at: overrides?.created_at ?? now,
  };
}

// ---------------------------------------------------------------------------
// Extend MockAcontextClient to include learningSpaces
// ---------------------------------------------------------------------------

class TestClient {
  private requester: InstanceType<typeof MockAcontextClient>['requester'];
  public learningSpaces: LearningSpacesAPI;

  constructor(client: MockAcontextClient) {
    this.requester = client.requester;
    this.learningSpaces = new LearningSpacesAPI(this.requester);
  }

  mock() {
    return this.requester;
  }

  reset() {
    this.requester.reset();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LearningSpacesAPI Unit Tests', () => {
  let mockClient: MockAcontextClient;
  let client: TestClient;

  beforeEach(() => {
    mockClient = createMockClient();
    client = new TestClient(mockClient);
    resetMockIds();
  });

  afterEach(() => {
    client.reset();
  });

  // ── Create ──

  describe('create', () => {
    test('should create a learning space', async () => {
      const space = mockLearningSpace({ meta: { version: '1.0' } });
      client.mock().onPost('/learning_spaces', (options) => {
        expect(options?.jsonData).toEqual({
          user: 'alice',
          meta: { version: '1.0' },
        });
        return space;
      });

      const result = await client.learningSpaces.create({
        user: 'alice',
        meta: { version: '1.0' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(space.id);
      expect(result.meta).toEqual({ version: '1.0' });
    });

    test('should create a learning space without user', async () => {
      const space = mockLearningSpace();
      client.mock().onPost('/learning_spaces', () => space);

      const result = await client.learningSpaces.create();

      expect(result).toBeDefined();
    });
  });

  // ── List ──

  describe('list', () => {
    test('should list learning spaces', async () => {
      const spaces = [mockLearningSpace(), mockLearningSpace()];
      client
        .mock()
        .onGet('/learning_spaces', () =>
          mockPaginatedList(spaces, false)
        );

      const result = await client.learningSpaces.list({ limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.has_more).toBe(false);
    });

    test('should list with user filter', async () => {
      client.mock().onGet('/learning_spaces', (options) => {
        expect(options?.params?.user).toBe('alice');
        return mockPaginatedList([mockLearningSpace()], false);
      });

      const result = await client.learningSpaces.list({ user: 'alice' });
      expect(result.items).toHaveLength(1);
    });

    test('should list with meta filter', async () => {
      client.mock().onGet('/learning_spaces', (options) => {
        expect(options?.params?.filter_by_meta).toBe(
          JSON.stringify({ version: '1.0' })
        );
        return mockPaginatedList([mockLearningSpace()], false);
      });

      const result = await client.learningSpaces.list({
        filterByMeta: { version: '1.0' },
      });
      expect(result.items).toHaveLength(1);
    });
  });

  // ── Get ──

  describe('get', () => {
    test('should get a learning space by ID', async () => {
      const space = mockLearningSpace();
      client
        .mock()
        .onGet(
          new RegExp(`/learning_spaces/.+`),
          () => space
        );

      const result = await client.learningSpaces.get('space-id');

      expect(result).toBeDefined();
      expect(result.id).toBe(space.id);
    });
  });

  // ── Update ──

  describe('update', () => {
    test('should update learning space meta', async () => {
      const updated = mockLearningSpace({ meta: { version: '2.0' } });
      client
        .mock()
        .onPatch(new RegExp(`/learning_spaces/.+`), (options) => {
          expect(options?.jsonData).toEqual({ meta: { version: '2.0' } });
          return updated;
        });

      const result = await client.learningSpaces.update('space-id', {
        meta: { version: '2.0' },
      });

      expect(result.meta).toEqual({ version: '2.0' });
    });
  });

  // ── Delete ──

  describe('delete', () => {
    test('should delete a learning space', async () => {
      client
        .mock()
        .onDelete(new RegExp(`/learning_spaces/.+`), () => undefined);

      await expect(
        client.learningSpaces.delete('space-id')
      ).resolves.toBeUndefined();
    });
  });

  // ── Learn ──

  describe('learn', () => {
    test('should learn from session', async () => {
      const lss = mockLearningSpaceSession({ status: 'pending' });
      client
        .mock()
        .onPost(new RegExp(`/learning_spaces/.+/learn`), (options) => {
          expect(options?.jsonData).toEqual({ session_id: 'sess-1' });
          return lss;
        });

      const result = await client.learningSpaces.learn({
        spaceId: 'space-id',
        sessionId: 'sess-1',
      });

      expect(result.status).toBe('pending');
      expect(result.session_id).toBe(lss.session_id);
    });
  });

  // ── List Sessions ──

  describe('listSessions', () => {
    test('should list sessions in space', async () => {
      const sessions = [
        mockLearningSpaceSession({ status: 'pending' }),
        mockLearningSpaceSession({ status: 'completed' }),
      ];
      client
        .mock()
        .onGet(new RegExp(`/learning_spaces/.+/sessions`), () => sessions);

      const result = await client.learningSpaces.listSessions('space-id');

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending');
      expect(result[1].status).toBe('completed');
    });
  });

  // ── Include Skill ──

  describe('includeSkill', () => {
    test('should include a skill in space', async () => {
      const lsk = mockLearningSpaceSkill({ skill_id: 'skill-1' });
      client
        .mock()
        .onPost(new RegExp(`/learning_spaces/.+/skills`), (options) => {
          expect(options?.jsonData).toEqual({ skill_id: 'skill-1' });
          return lsk;
        });

      const result = await client.learningSpaces.includeSkill({
        spaceId: 'space-id',
        skillId: 'skill-1',
      });

      expect(result.skill_id).toBe('skill-1');
    });
  });

  // ── List Skills ──

  describe('listSkills', () => {
    test('should list skills in space', async () => {
      const skills = [mockSkill({ name: 'skill-a' }), mockSkill({ name: 'skill-b' })];
      client
        .mock()
        .onGet(new RegExp(`/learning_spaces/.+/skills`), () => skills);

      const result = await client.learningSpaces.listSkills('space-id');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('skill-a');
      expect(result[1].name).toBe('skill-b');
    });
  });

  // ── Exclude Skill ──

  describe('excludeSkill', () => {
    test('should exclude a skill from space', async () => {
      client
        .mock()
        .onDelete(
          new RegExp(`/learning_spaces/.+/skills/.+`),
          () => undefined
        );

      await expect(
        client.learningSpaces.excludeSkill({
          spaceId: 'space-id',
          skillId: 'skill-1',
        })
      ).resolves.toBeUndefined();
    });
  });

  // ── Get Session ──

  describe('getSession', () => {
    test('should get a session by ID', async () => {
      const session = mockLearningSpaceSession({ status: 'completed' });
      client
        .mock()
        .onGet(
          new RegExp(`/learning_spaces/.+/sessions/.+`),
          () => session
        );

      const result = await client.learningSpaces.getSession({
        spaceId: 'space-id',
        sessionId: 'sess-id',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  // ── Wait for Learning ──

  describe('waitForLearning', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should return immediately when already completed', async () => {
      const session = mockLearningSpaceSession({ status: 'completed' });
      client
        .mock()
        .onGet(
          new RegExp(`/learning_spaces/.+/sessions/.+`),
          () => session
        );

      const result = await client.learningSpaces.waitForLearning({
        spaceId: 'space-id',
        sessionId: 'sess-id',
      });

      expect(result.status).toBe('completed');
    });

    test('should return on failed status', async () => {
      const session = mockLearningSpaceSession({ status: 'failed' });
      client
        .mock()
        .onGet(
          new RegExp(`/learning_spaces/.+/sessions/.+`),
          () => session
        );

      const result = await client.learningSpaces.waitForLearning({
        spaceId: 'space-id',
        sessionId: 'sess-id',
      });

      expect(result.status).toBe('failed');
    });

    test('should poll until completed', async () => {
      let callCount = 0;
      const responses = [
        mockLearningSpaceSession({ status: 'pending' }),
        mockLearningSpaceSession({ status: 'running' }),
        mockLearningSpaceSession({ status: 'completed' }),
      ];
      client
        .mock()
        .onGet(
          new RegExp(`/learning_spaces/.+/sessions/.+`),
          () => responses[callCount++]
        );

      const promise = client.learningSpaces.waitForLearning({
        spaceId: 'space-id',
        sessionId: 'sess-id',
        pollInterval: 1,
      });

      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result.status).toBe('completed');
      expect(callCount).toBe(3);
    });

    test('should throw TimeoutError on timeout', async () => {
      const session = mockLearningSpaceSession({ status: 'pending' });
      client
        .mock()
        .onGet(
          new RegExp(`/learning_spaces/.+/sessions/.+`),
          () => session
        );

      const promise = client.learningSpaces.waitForLearning({
        spaceId: 'space-id',
        sessionId: 'sess-id',
        timeout: 3,
        pollInterval: 1,
      });

      const errorPromise = promise.catch((e: unknown) => e);

      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(1000);
      }

      const error = await errorPromise;
      expect(error).toBeInstanceOf(TimeoutError);
    });
  });
});

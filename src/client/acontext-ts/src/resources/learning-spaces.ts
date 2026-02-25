/**
 * Learning Spaces endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { TimeoutError } from '../errors';
import { buildParams } from '../utils';
import {
  LearningSpace,
  LearningSpaceSchema,
  LearningSpaceSession,
  LearningSpaceSessionSchema,
  LearningSpaceSkill,
  LearningSpaceSkillSchema,
  ListLearningSpacesOutput,
  ListLearningSpacesOutputSchema,
  Skill,
  SkillSchema,
} from '../types';

export class LearningSpacesAPI {
  constructor(private requester: RequesterProtocol) {}

  /**
   * Create a new learning space.
   */
  async create(options?: {
    user?: string | null;
    meta?: Record<string, unknown> | null;
  }): Promise<LearningSpace> {
    const payload: Record<string, unknown> = {};
    if (options?.user !== undefined && options.user !== null) {
      payload.user = options.user;
    }
    if (options?.meta !== undefined && options.meta !== null) {
      payload.meta = options.meta;
    }
    const data = await this.requester.request('POST', '/learning_spaces', {
      jsonData: payload,
    });
    return LearningSpaceSchema.parse(data);
  }

  /**
   * List learning spaces with optional filters and pagination.
   */
  async list(options?: {
    user?: string | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
    filterByMeta?: Record<string, unknown> | null;
  }): Promise<ListLearningSpacesOutput> {
    const effectiveLimit = options?.limit ?? 20;
    const params = buildParams({
      user: options?.user ?? null,
      limit: effectiveLimit,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    if (options?.filterByMeta && Object.keys(options.filterByMeta).length > 0) {
      params.filter_by_meta = JSON.stringify(options.filterByMeta);
    }
    const data = await this.requester.request('GET', '/learning_spaces', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListLearningSpacesOutputSchema.parse(data);
  }

  /**
   * Get a learning space by ID.
   */
  async get(spaceId: string): Promise<LearningSpace> {
    const data = await this.requester.request('GET', `/learning_spaces/${spaceId}`);
    return LearningSpaceSchema.parse(data);
  }

  /**
   * Update a learning space by merging meta into existing meta.
   */
  async update(
    spaceId: string,
    options: { meta: Record<string, unknown> }
  ): Promise<LearningSpace> {
    const data = await this.requester.request('PATCH', `/learning_spaces/${spaceId}`, {
      jsonData: { meta: options.meta },
    });
    return LearningSpaceSchema.parse(data);
  }

  /**
   * Delete a learning space by ID.
   */
  async delete(spaceId: string): Promise<void> {
    await this.requester.request('DELETE', `/learning_spaces/${spaceId}`);
  }

  /**
   * Create an async learning record from a session.
   */
  async learn(options: {
    spaceId: string;
    sessionId: string;
  }): Promise<LearningSpaceSession> {
    const data = await this.requester.request(
      'POST',
      `/learning_spaces/${options.spaceId}/learn`,
      { jsonData: { session_id: options.sessionId } }
    );
    return LearningSpaceSessionSchema.parse(data);
  }

  /**
   * Get a single learning session record by session ID.
   */
  async getSession(options: {
    spaceId: string;
    sessionId: string;
  }): Promise<LearningSpaceSession> {
    const data = await this.requester.request(
      'GET',
      `/learning_spaces/${options.spaceId}/sessions/${options.sessionId}`
    );
    return LearningSpaceSessionSchema.parse(data);
  }

  /**
   * Poll until a learning session reaches a terminal status.
   */
  async waitForLearning(options: {
    spaceId: string;
    sessionId: string;
    timeout?: number;
    pollInterval?: number;
  }): Promise<LearningSpaceSession> {
    const timeout = options.timeout ?? 120;
    const pollInterval = options.pollInterval ?? 1;
    const terminal = new Set(['completed', 'failed']);
    const deadline = Date.now() + timeout * 1000;

    while (true) {
      const session = await this.getSession({
        spaceId: options.spaceId,
        sessionId: options.sessionId,
      });
      if (terminal.has(session.status)) {
        return session;
      }
      if (Date.now() >= deadline) {
        throw new TimeoutError(
          `learning session ${options.sessionId} did not complete within ${timeout}s ` +
            `(last status: ${session.status})`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
    }
  }

  /**
   * List all learning session records for a space.
   */
  async listSessions(spaceId: string): Promise<LearningSpaceSession[]> {
    const data = await this.requester.request(
      'GET',
      `/learning_spaces/${spaceId}/sessions`
    );
    return (data as unknown[]).map((item) => LearningSpaceSessionSchema.parse(item));
  }

  /**
   * Include a skill in a learning space.
   */
  async includeSkill(options: {
    spaceId: string;
    skillId: string;
  }): Promise<LearningSpaceSkill> {
    const data = await this.requester.request(
      'POST',
      `/learning_spaces/${options.spaceId}/skills`,
      { jsonData: { skill_id: options.skillId } }
    );
    return LearningSpaceSkillSchema.parse(data);
  }

  /**
   * List all skills in a learning space. Returns full skill data.
   */
  async listSkills(spaceId: string): Promise<Skill[]> {
    const data = await this.requester.request(
      'GET',
      `/learning_spaces/${spaceId}/skills`
    );
    return (data as unknown[]).map((item) => SkillSchema.parse(item));
  }

  /**
   * Remove a skill from a learning space. Idempotent.
   */
  async excludeSkill(options: {
    spaceId: string;
    skillId: string;
  }): Promise<void> {
    await this.requester.request(
      'DELETE',
      `/learning_spaces/${options.spaceId}/skills/${options.skillId}`
    );
  }
}

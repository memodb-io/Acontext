/**
 * Spaces endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { buildParams } from '../utils';
import {
  ExperienceConfirmation,
  ExperienceConfirmationSchema,
  ListExperienceConfirmationsOutput,
  ListExperienceConfirmationsOutputSchema,
  ListSpacesOutput,
  ListSpacesOutputSchema,
  Space,
  SpaceSchema,
  SpaceSearchResult,
  SpaceSearchResultSchema,
} from '../types';

export class SpacesAPI {
  constructor(private requester: RequesterProtocol) { }

  async list(options?: {
    user?: string | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListSpacesOutput> {
    const params = buildParams({
      user: options?.user ?? null,
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', '/space', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListSpacesOutputSchema.parse(data);
  }

  async create(options?: {
    user?: string | null;
    configs?: Record<string, unknown>;
  }): Promise<Space> {
    const payload: Record<string, unknown> = {};
    if (options?.user !== undefined && options?.user !== null) {
      payload.user = options.user;
    }
    if (options?.configs !== undefined) {
      payload.configs = options.configs;
    }
    const data = await this.requester.request('POST', '/space', {
      jsonData: Object.keys(payload).length > 0 ? payload : undefined,
    });
    return SpaceSchema.parse(data);
  }

  async delete(spaceId: string): Promise<void> {
    await this.requester.request('DELETE', `/space/${spaceId}`);
  }

  async updateConfigs(
    spaceId: string,
    options: {
      configs: Record<string, unknown>;
    }
  ): Promise<void> {
    const payload = { configs: options.configs };
    await this.requester.request('PUT', `/space/${spaceId}/configs`, {
      jsonData: payload,
    });
  }

  async getConfigs(spaceId: string): Promise<Space> {
    const data = await this.requester.request('GET', `/space/${spaceId}/configs`);
    return SpaceSchema.parse(data);
  }

  /**
   * Perform experience search within a space.
   * 
   * This is the most advanced search option that can operate in two modes:
   * - fast: Quick semantic search (default)
   * - agentic: Iterative search with AI-powered refinement
   * 
   * @param spaceId - The UUID of the space
   * @param options - Search options
   * @returns SpaceSearchResult containing cited blocks and optional final answer
   */
  async experienceSearch(
    spaceId: string,
    options: {
      query: string;
      limit?: number | null;
      mode?: 'fast' | 'agentic' | null;
      semanticThreshold?: number | null;
      maxIterations?: number | null;
    }
  ): Promise<SpaceSearchResult> {
    const params = buildParams({
      query: options.query,
      limit: options.limit ?? null,
      mode: options.mode ?? null,
      semantic_threshold: options.semanticThreshold ?? null,
      max_iterations: options.maxIterations ?? null,
    });
    const data = await this.requester.request(
      'GET',
      `/space/${spaceId}/experience_search`,
      { params: Object.keys(params).length > 0 ? params : undefined }
    );
    return SpaceSearchResultSchema.parse(data);
  }

  /**
   * Get all unconfirmed experiences in a space with cursor-based pagination.
   * 
   * @param spaceId - The UUID of the space
   * @param options - Pagination options
   * @returns ListExperienceConfirmationsOutput containing the list of experience confirmations and pagination information
   */
  async getUnconfirmedExperiences(
    spaceId: string,
    options?: {
      limit?: number | null;
      cursor?: string | null;
      timeDesc?: boolean | null;
    }
  ): Promise<ListExperienceConfirmationsOutput> {
    const params = buildParams({
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request(
      'GET',
      `/space/${spaceId}/experience_confirmations`,
      { params: Object.keys(params).length > 0 ? params : undefined }
    );
    return ListExperienceConfirmationsOutputSchema.parse(data);
  }

  /**
   * Confirm an experience confirmation.
   * 
   * If save is false, delete the row. If save is true, get the data first,
   * then delete the row.
   * 
   * @param spaceId - The UUID of the space
   * @param experienceId - The UUID of the experience confirmation
   * @param options - Confirmation options
   * @returns ExperienceConfirmation object if save is true, null otherwise
   */
  async confirmExperience(
    spaceId: string,
    experienceId: string,
    options: {
      save: boolean;
    }
  ): Promise<ExperienceConfirmation | null> {
    const payload = { save: options.save };
    const data = await this.requester.request(
      'PUT',
      `/space/${spaceId}/experience_confirmations/${experienceId}`,
      { jsonData: payload }
    );
    if (data === null || data === undefined) {
      return null;
    }
    return ExperienceConfirmationSchema.parse(data);
  }
}


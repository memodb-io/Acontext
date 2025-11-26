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
  SearchResultBlockItem,
  SearchResultBlockItemSchema,
  Space,
  SpaceSchema,
  SpaceSearchResult,
  SpaceSearchResultSchema,
} from '../types';

export class SpacesAPI {
  constructor(private requester: RequesterProtocol) { }

  async list(options?: {
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListSpacesOutput> {
    const params = buildParams({
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
    configs?: Record<string, unknown>;
  }): Promise<Space> {
    const payload: Record<string, unknown> = {};
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
   * Perform semantic glob (glob) search for page/folder titles.
   * 
   * Searches specifically for page/folder titles using semantic similarity,
   * similar to a semantic version of the glob command.
   * 
   * @param spaceId - The UUID of the space
   * @param options - Search options
   * @returns List of SearchResultBlockItem objects matching the query
   */
  async semanticGlobal(
    spaceId: string,
    options: {
      query: string;
      limit?: number | null;
      threshold?: number | null;
    }
  ): Promise<SearchResultBlockItem[]> {
    const params = buildParams({
      query: options.query,
      limit: options.limit ?? null,
      threshold: options.threshold ?? null,
    });
    const data = await this.requester.request(
      'GET',
      `/space/${spaceId}/semantic_glob`,
      { params: Object.keys(params).length > 0 ? params : undefined }
    );
    return (data as unknown[]).map((item) =>
      SearchResultBlockItemSchema.parse(item)
    );
  }

  /**
   * Perform semantic grep search for content blocks.
   * 
   * Searches through content blocks (actual text content) using semantic similarity,
   * similar to a semantic version of the grep command.
   * 
   * @param spaceId - The UUID of the space
   * @param options - Search options
   * @returns List of SearchResultBlockItem objects matching the query
   */
  async semanticGrep(
    spaceId: string,
    options: {
      query: string;
      limit?: number | null;
      threshold?: number | null;
    }
  ): Promise<SearchResultBlockItem[]> {
    const params = buildParams({
      query: options.query,
      limit: options.limit ?? null,
      threshold: options.threshold ?? null,
    });
    const data = await this.requester.request(
      'GET',
      `/space/${spaceId}/semantic_grep`,
      { params: Object.keys(params).length > 0 ? params : undefined }
    );
    return (data as unknown[]).map((item) =>
      SearchResultBlockItemSchema.parse(item)
    );
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
      `/space/${spaceId}/get_unconfirmed_experiences`,
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
    const params = buildParams({
      save: options.save,
    });
    const data = await this.requester.request(
      'POST',
      `/space/${spaceId}/confirm_experience/${experienceId}`,
      { params: Object.keys(params).length > 0 ? params : undefined }
    );
    if (data === null || data === undefined) {
      return null;
    }
    return ExperienceConfirmationSchema.parse(data);
  }
}


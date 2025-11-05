/**
 * Spaces endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { buildParams } from '../utils';
import { ListSpacesOutput, ListSpacesOutputSchema, Space, SpaceSchema } from '../types';

export class SpacesAPI {
  constructor(private requester: RequesterProtocol) {}

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
}


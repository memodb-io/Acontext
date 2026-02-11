/**
 * Tool management endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { buildParams } from '../utils';
import {
  ListToolsOutput,
  ListToolsOutputSchema,
  SearchToolsOutput,
  SearchToolsOutputSchema,
  Tool,
  ToolSchema,
  ToolSchemaFormat,
} from '../types';

export class ToolsAPI {
  constructor(private requester: RequesterProtocol) {}

  async upsert(options: {
    openaiSchema: Record<string, unknown>;
    config?: Record<string, unknown> | null;
    user?: string | null;
  }): Promise<Tool> {
    const payload: Record<string, unknown> = {
      openai_schema: options.openaiSchema,
    };
    if (options.config !== undefined && options.config !== null) {
      payload.config = options.config;
    }
    if (options.user !== undefined && options.user !== null) {
      payload.user = options.user;
    }
    const data = await this.requester.request('POST', '/tools', {
      jsonData: payload,
    });
    return ToolSchema.parse(data);
  }

  async list(options?: {
    user?: string | null;
    filterConfig?: Record<string, unknown> | null;
    format?: ToolSchemaFormat | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListToolsOutput> {
    const params: Record<string, string | number> = {};
    if (options?.user !== undefined && options.user !== null) {
      params.user = options.user;
    }
    if (options?.filterConfig && Object.keys(options.filterConfig).length > 0) {
      params.filter_config = JSON.stringify(options.filterConfig);
    }
    Object.assign(
      params,
      buildParams({
        format: options?.format ?? null,
        limit: options?.limit ?? null,
        cursor: options?.cursor ?? null,
        time_desc: options?.timeDesc ?? null,
      })
    );
    const data = await this.requester.request('GET', '/tools', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListToolsOutputSchema.parse(data);
  }

  async search(options: {
    query: string;
    user?: string | null;
    format?: ToolSchemaFormat | null;
    limit?: number | null;
  }): Promise<SearchToolsOutput> {
    const params: Record<string, string | number> = {
      query: options.query,
    };
    if (options.user !== undefined && options.user !== null) {
      params.user = options.user;
    }
    Object.assign(
      params,
      buildParams({
        format: options.format ?? null,
        limit: options.limit ?? null,
      })
    );
    const data = await this.requester.request('GET', '/tools/search', {
      params,
    });
    return SearchToolsOutputSchema.parse(data);
  }

  async delete(name: string, options?: { user?: string | null }): Promise<void> {
    const params: Record<string, string | number> = {};
    if (options?.user !== undefined && options.user !== null) {
      params.user = options.user;
    }
    await this.requester.request('DELETE', `/tools/${encodeURIComponent(name)}`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
  }
}


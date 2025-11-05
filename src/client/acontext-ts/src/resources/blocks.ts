/**
 * Block endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { Block, BlockSchema } from '../types';

export class BlocksAPI {
  constructor(private requester: RequesterProtocol) {}

  async list(
    spaceId: string,
    options?: {
      parentId?: string | null;
      blockType?: string | null;
    }
  ): Promise<Block[]> {
    const params: Record<string, string | number> = {};
    if (options?.parentId !== undefined && options?.parentId !== null) {
      params.parent_id = options.parentId;
    }
    if (options?.blockType !== undefined && options?.blockType !== null) {
      params.type = options.blockType;
    }
    const data = await this.requester.request('GET', `/space/${spaceId}/block`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return Array.isArray(data) ? data.map((item) => BlockSchema.parse(item)) : [];
  }

  async create(
    spaceId: string,
    options: {
      blockType: string;
      parentId?: string | null;
      title?: string | null;
      props?: Record<string, unknown> | null;
    }
  ): Promise<Block> {
    const payload: Record<string, unknown> = { type: options.blockType };
    if (options.parentId !== undefined && options.parentId !== null) {
      payload.parent_id = options.parentId;
    }
    if (options.title !== undefined && options.title !== null) {
      payload.title = options.title;
    }
    if (options.props !== undefined && options.props !== null) {
      payload.props = options.props;
    }
    const data = await this.requester.request('POST', `/space/${spaceId}/block`, {
      jsonData: payload,
    });
    return BlockSchema.parse(data);
  }

  async delete(spaceId: string, blockId: string): Promise<void> {
    await this.requester.request('DELETE', `/space/${spaceId}/block/${blockId}`);
  }

  async getProperties(spaceId: string, blockId: string): Promise<Block> {
    const data = await this.requester.request('GET', `/space/${spaceId}/block/${blockId}/properties`);
    return BlockSchema.parse(data);
  }

  async updateProperties(
    spaceId: string,
    blockId: string,
    options: {
      title?: string | null;
      props?: Record<string, unknown> | null;
    }
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (options.title !== undefined && options.title !== null) {
      payload.title = options.title;
    }
    if (options.props !== undefined && options.props !== null) {
      payload.props = options.props;
    }
    if (Object.keys(payload).length === 0) {
      throw new Error('title or props must be provided');
    }
    await this.requester.request('PUT', `/space/${spaceId}/block/${blockId}/properties`, {
      jsonData: payload,
    });
  }

  async move(
    spaceId: string,
    blockId: string,
    options: {
      parentId?: string | null;
      sort?: number | null;
    }
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (options.parentId !== undefined && options.parentId !== null) {
      payload.parent_id = options.parentId;
    }
    if (options.sort !== undefined && options.sort !== null) {
      payload.sort = options.sort;
    }
    if (Object.keys(payload).length === 0) {
      throw new Error('parentId or sort must be provided');
    }
    await this.requester.request('PUT', `/space/${spaceId}/block/${blockId}/move`, {
      jsonData: payload,
    });
  }

  async updateSort(
    spaceId: string,
    blockId: string,
    options: {
      sort: number;
    }
  ): Promise<void> {
    await this.requester.request('PUT', `/space/${spaceId}/block/${blockId}/sort`, {
      jsonData: { sort: options.sort },
    });
  }
}


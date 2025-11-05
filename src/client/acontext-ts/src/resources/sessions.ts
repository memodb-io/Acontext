/**
 * Sessions endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { AcontextMessage } from '../messages';
import { FileUpload } from '../uploads';
import { buildParams } from '../utils';
import {
  GetMessagesOutput,
  GetMessagesOutputSchema,
  GetTasksOutput,
  GetTasksOutputSchema,
  ListSessionsOutput,
  ListSessionsOutputSchema,
  Message,
  MessageSchema,
  Session,
  SessionSchema,
} from '../types';

export type MessageBlob = AcontextMessage | Record<string, unknown>;

export class SessionsAPI {
  constructor(private requester: RequesterProtocol) {}

  async list(options?: {
    spaceId?: string | null;
    notConnected?: boolean | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListSessionsOutput> {
    const params: Record<string, string | number> = {};
    if (options?.spaceId) {
      params.space_id = options.spaceId;
    }
    Object.assign(
      params,
      buildParams({
        not_connected: options?.notConnected ?? null,
        limit: options?.limit ?? null,
        cursor: options?.cursor ?? null,
        time_desc: options?.timeDesc ?? null,
      })
    );
    const data = await this.requester.request('GET', '/session', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListSessionsOutputSchema.parse(data);
  }

  async create(options?: {
    spaceId?: string | null;
    configs?: Record<string, unknown>;
  }): Promise<Session> {
    const payload: Record<string, unknown> = {};
    if (options?.spaceId) {
      payload.space_id = options.spaceId;
    }
    if (options?.configs !== undefined) {
      payload.configs = options.configs;
    }
    const data = await this.requester.request('POST', '/session', {
      jsonData: Object.keys(payload).length > 0 ? payload : undefined,
    });
    return SessionSchema.parse(data);
  }

  async delete(sessionId: string): Promise<void> {
    await this.requester.request('DELETE', `/session/${sessionId}`);
  }

  async updateConfigs(
    sessionId: string,
    options: {
      configs: Record<string, unknown>;
    }
  ): Promise<void> {
    const payload = { configs: options.configs };
    await this.requester.request('PUT', `/session/${sessionId}/configs`, {
      jsonData: payload,
    });
  }

  async getConfigs(sessionId: string): Promise<Session> {
    const data = await this.requester.request('GET', `/session/${sessionId}/configs`);
    return SessionSchema.parse(data);
  }

  async connectToSpace(
    sessionId: string,
    options: {
      spaceId: string;
    }
  ): Promise<void> {
    const payload = { space_id: options.spaceId };
    await this.requester.request('POST', `/session/${sessionId}/connect_to_space`, {
      jsonData: payload,
    });
  }

  async getTasks(
    sessionId: string,
    options?: {
      limit?: number | null;
      cursor?: string | null;
      timeDesc?: boolean | null;
    }
  ): Promise<GetTasksOutput> {
    const params = buildParams({
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', `/session/${sessionId}/task`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return GetTasksOutputSchema.parse(data);
  }

  async sendMessage(
    sessionId: string,
    blob: MessageBlob,
    options?: {
      format?: 'acontext' | 'openai' | 'anthropic';
      fileField?: string | null;
      file?: FileUpload | null;
    }
  ): Promise<Message> {
    const format = options?.format ?? 'openai';
    if (!['acontext', 'openai', 'anthropic'].includes(format)) {
      throw new Error("format must be one of {'acontext', 'openai', 'anthropic'}");
    }

    if (options?.file && !options?.fileField) {
      throw new Error('fileField is required when file is provided');
    }

    const payload: Record<string, unknown> = {
      format,
    };

    if (format === 'acontext') {
      if (blob instanceof AcontextMessage) {
        payload.blob = blob.toJSON();
      } else {
        // Try to parse as AcontextMessageInput
        const message = new AcontextMessage(blob as any);
        payload.blob = message.toJSON();
      }
    } else {
      payload.blob = blob;
    }

    if (options?.file && options?.fileField) {
      const formData: Record<string, string> = {
        payload: JSON.stringify(payload),
      };
      const files = {
        [options.fileField]: options.file.asFormData(),
      };
      const data = await this.requester.request('POST', `/session/${sessionId}/messages`, {
        data: formData,
        files,
      });
      return MessageSchema.parse(data);
    } else {
      const data = await this.requester.request('POST', `/session/${sessionId}/messages`, {
        jsonData: payload,
      });
      return MessageSchema.parse(data);
    }
  }

  async getMessages(
    sessionId: string,
    options?: {
      limit?: number | null;
      cursor?: string | null;
      withAssetPublicUrl?: boolean | null;
      format?: 'acontext' | 'openai' | 'anthropic';
      timeDesc?: boolean | null;
    }
  ): Promise<GetMessagesOutput> {
    const params: Record<string, string | number> = {};
    if (options?.format !== undefined) {
      params.format = options.format;
    }
    Object.assign(
      params,
      buildParams({
        limit: options?.limit ?? null,
        cursor: options?.cursor ?? null,
        with_asset_public_url: options?.withAssetPublicUrl ?? null,
        time_desc: options?.timeDesc ?? null,
      })
    );
    const data = await this.requester.request('GET', `/session/${sessionId}/messages`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return GetMessagesOutputSchema.parse(data);
  }
}


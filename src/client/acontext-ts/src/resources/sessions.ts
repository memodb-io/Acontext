/**
 * Sessions endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { AcontextMessage, AcontextMessageInput } from '../messages';
import { FileUpload } from '../uploads';
import { buildParams } from '../utils';
import {
  EditStrategy,
  EditStrategySchema,
  GetMessagesOutput,
  GetMessagesOutputSchema,
  GetTasksOutput,
  GetTasksOutputSchema,
  ListSessionsOutput,
  ListSessionsOutputSchema,
  Message,
  MessageObservingStatus,
  MessageObservingStatusSchema,
  MessageSchema,
  Session,
  SessionSchema,
  TokenCounts,
  TokenCountsSchema,
} from '../types';

export type MessageBlob = AcontextMessage | Record<string, unknown>;

export class SessionsAPI {
  constructor(private requester: RequesterProtocol) { }

  async list(options?: {
    user?: string | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListSessionsOutput> {
    const params: Record<string, string | number> = {};
    if (options?.user) {
      params.user = options.user;
    }
    Object.assign(
      params,
      buildParams({
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
    user?: string | null;
    disableTaskTracking?: boolean | null;
    configs?: Record<string, unknown>;
  }): Promise<Session> {
    const payload: Record<string, unknown> = {};
    if (options?.user !== undefined && options?.user !== null) {
      payload.user = options.user;
    }
    if (options?.disableTaskTracking !== undefined && options?.disableTaskTracking !== null) {
      payload.disable_task_tracking = options.disableTaskTracking;
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

  /**
   * Get a summary of all tasks in a session as a formatted string.
   *
   * @param sessionId - The UUID of the session.
   * @param options - Options for retrieving the summary.
   * @param options.limit - Maximum number of tasks to include in the summary.
   * @returns A formatted string containing the session summary with all task information.
   */
  async getSessionSummary(
    sessionId: string,
    options?: {
      limit?: number | null;
    }
  ): Promise<string> {
    const tasksOutput = await this.getTasks(sessionId, {
      limit: options?.limit,
      timeDesc: false,
    });
    const tasks = tasksOutput.items;

    if (tasks.length === 0) {
      return '';
    }

    const parts: string[] = [];
    for (const task of tasks) {
      const taskLines: string[] = [
        `<task id="${task.order}" description="${task.data.task_description}">`
      ];
      if (task.data.progresses && task.data.progresses.length > 0) {
        taskLines.push('<progress>');
        task.data.progresses.forEach((p, i) => {
          taskLines.push(`${i + 1}. ${p}`);
        });
        taskLines.push('</progress>');
      }
      if (task.data.user_preferences && task.data.user_preferences.length > 0) {
        taskLines.push('<user_preference>');
        task.data.user_preferences.forEach((pref, i) => {
          taskLines.push(`${i + 1}. ${pref}`);
        });
        taskLines.push('</user_preference>');
      }
      taskLines.push('</task>');
      parts.push(taskLines.join('\n'));
    }

    return parts.join('\n');
  }

  async storeMessage(
    sessionId: string,
    blob: MessageBlob,
    options?: {
      format?: 'acontext' | 'openai' | 'anthropic' | 'gemini';
      fileField?: string | null;
      file?: FileUpload | null;
    }
  ): Promise<Message> {
    const format = options?.format ?? 'openai';
    if (!['acontext', 'openai', 'anthropic', 'gemini'].includes(format)) {
      throw new Error("format must be one of {'acontext', 'openai', 'anthropic', 'gemini'}");
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
        // MessageBlob can be Record<string, unknown>, which may not match AcontextMessageInput exactly
        const message = new AcontextMessage(blob as AcontextMessageInput);
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

  /**
   * Get messages for a session.
   *
   * @param sessionId - The UUID of the session.
   * @param options - Options for retrieving messages.
   * @param options.limit - Maximum number of messages to return.
   * @param options.cursor - Cursor for pagination.
   * @param options.withAssetPublicUrl - Whether to include presigned URLs for assets.
   * @param options.format - The format of the messages ('acontext', 'openai', 'anthropic', or 'gemini').
   * @param options.timeDesc - Order by created_at descending if true, ascending if false.
   * @param options.editStrategies - Optional list of edit strategies to apply before format conversion.
   *   Examples:
   *   - Remove tool results: [{ type: 'remove_tool_result', params: { keep_recent_n_tool_results: 3 } }]
   *   - Remove large tool results: [{ type: 'remove_tool_result', params: { gt_token: 100 } }]
   *   - Remove large tool call params: [{ type: 'remove_tool_call_params', params: { gt_token: 100 } }]
   *   - Middle out: [{ type: 'middle_out', params: { token_reduce_to: 5000 } }]
   *   - Token limit: [{ type: 'token_limit', params: { limit_tokens: 20000 } }]
   *   Throws if editStrategies fail schema validation.
   * @param options.pinEditingStrategiesAtMessage - Message ID to pin editing strategies at.
   *   When provided, strategies are only applied to messages up to and including this message ID,
   *   keeping subsequent messages unchanged. This helps maintain prompt cache stability by
   *   preserving a stable prefix. The response includes edit_at_message_id indicating where
   *   strategies were applied. Pass this value in subsequent requests to maintain cache hits.
   * @returns GetMessagesOutput containing the list of messages and pagination information.
   */
  async getMessages(
    sessionId: string,
    options?: {
      limit?: number | null;
      cursor?: string | null;
      withAssetPublicUrl?: boolean | null;
      format?: 'acontext' | 'openai' | 'anthropic' | 'gemini';
      timeDesc?: boolean | null;
      editStrategies?: Array<EditStrategy> | null;
      pinEditingStrategiesAtMessage?: string | null;
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
        time_desc: options?.timeDesc ?? true, // Default to true
      })
    );
    if (options?.editStrategies !== undefined && options?.editStrategies !== null) {
      EditStrategySchema.array().parse(options.editStrategies);
      params.edit_strategies = JSON.stringify(options.editStrategies);
    }
    if (options?.pinEditingStrategiesAtMessage !== undefined && options?.pinEditingStrategiesAtMessage !== null) {
      params.pin_editing_strategies_at_message = options.pinEditingStrategiesAtMessage;
    }
    const data = await this.requester.request('GET', `/session/${sessionId}/messages`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return GetMessagesOutputSchema.parse(data);
  }

  async flush(sessionId: string): Promise<{ status: number; errmsg: string }> {
    const data = await this.requester.request('POST', `/session/${sessionId}/flush`);
    return data as { status: number; errmsg: string };
  }

  /**
   * Get total token counts for all text and tool-call parts in a session.
   *
   * @param sessionId - The UUID of the session.
   * @returns TokenCounts object containing total_tokens.
   */
  async getTokenCounts(sessionId: string): Promise<TokenCounts> {
    const data = await this.requester.request('GET', `/session/${sessionId}/token_counts`);
    return TokenCountsSchema.parse(data);
  }

  /**
   * Get message observing status counts for a session.
   *
   * Returns the count of messages by their observing status:
   * observed, in_process, and pending.
   *
   * @param sessionId - The UUID of the session.
   * @returns MessageObservingStatus object containing observed, in_process, 
   *          pending counts and updated_at timestamp.
   */
  async messagesObservingStatus(sessionId: string): Promise<MessageObservingStatus> {
    const data = await this.requester.request('GET', `/session/${sessionId}/observing_status`);
    return MessageObservingStatusSchema.parse(data);
  }
}

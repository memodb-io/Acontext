/**
 * Sessions endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { AcontextMessage, AcontextMessageInput } from '../messages';
import { FileUpload } from '../uploads';
import { buildParams, validateUUID } from '../utils';
import {
  EditStrategy,
  EditStrategySchema,
  ForkSessionResult,
  ForkSessionResultSchema,
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

  /**
   * List all sessions in the project.
   *
   * @param options - Options for listing sessions.
   * @param options.user - Filter by user identifier.
   * @param options.limit - Maximum number of sessions to return.
   * @param options.cursor - Cursor for pagination.
   * @param options.timeDesc - Order by created_at descending if true, ascending if false.
   * @param options.filterByConfigs - Filter by session configs using JSONB containment.
   *   Only sessions where configs contains all key-value pairs in this object will be returned.
   *   Supports nested objects. Note: Matching is case-sensitive and type-sensitive.
   *   Sessions with NULL configs are excluded from filtered results.
   * @returns ListSessionsOutput containing the list of sessions and pagination information.
   */
  async list(options?: {
    user?: string | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
    filterByConfigs?: Record<string, unknown> | null;
  }): Promise<ListSessionsOutput> {
    const params: Record<string, string | number> = {};
    if (options?.user) {
      params.user = options.user;
    }
    // Handle filterByConfigs - JSON encode, skip empty object
    if (options?.filterByConfigs && Object.keys(options.filterByConfigs).length > 0) {
      params.filter_by_configs = JSON.stringify(options.filterByConfigs);
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

  /**
   * Create a new session.
   *
   * @param options - Options for creating a session.
   * @param options.user - Optional user identifier string.
   * @param options.disableTaskTracking - Whether to disable task tracking for this session.
   * @param options.configs - Optional session configuration dictionary.
   * @param options.useUuid - Optional UUID string to use as the session ID. If not provided, a UUID will be auto-generated.
   *   If a session with this UUID already exists, a 409 Conflict error will be raised.
   * @returns The created Session object.
   */
  async create(options?: {
    user?: string | null;
    disableTaskTracking?: boolean | null;
    configs?: Record<string, unknown>;
    useUuid?: string | null;
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
    if (options?.useUuid !== undefined && options?.useUuid !== null) {
      payload.use_uuid = options.useUuid;
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

  /**
   * Store a message to a session.
   *
   * @param sessionId - The UUID of the session.
   * @param blob - The message blob in Acontext, OpenAI, Anthropic, or Gemini format.
   * @param options - Options for storing the message.
   * @param options.format - The format of the message blob ('acontext', 'openai', 'anthropic', or 'gemini').
   * @param options.meta - Optional user-provided metadata for the message. This metadata is stored
   *   separately from the message content and can be retrieved via getMessages().metas
   *   or updated via patchMessageMeta(). Works with all formats.
   * @param options.fileField - The field name for file upload. Only used when format is 'acontext'.
   * @param options.file - Optional file upload. Only used when format is 'acontext'.
   * @returns The created Message object. The msg.meta field contains only user-provided metadata.
   */
  async storeMessage(
    sessionId: string,
    blob: MessageBlob,
    options?: {
      format?: 'acontext' | 'openai' | 'anthropic' | 'gemini';
      meta?: Record<string, unknown> | null;
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

    if (options?.meta !== undefined && options?.meta !== null) {
      payload.meta = options.meta;
    }

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

  /**
   * Update message metadata using patch semantics.
   *
   * Only updates keys present in the meta object. Existing keys not in the request
   * are preserved. To delete a key, pass null as its value.
   *
   * @param sessionId - The UUID of the session.
   * @param messageId - The UUID of the message.
   * @param meta - Object of metadata keys to add, update, or delete. Pass null as a value to delete that key.
   * @returns The complete user metadata after the patch operation.
   *
   * @example
   * // Add/update keys
   * const updated = await client.sessions.patchMessageMeta(
   *   sessionId, messageId,
   *   { status: 'processed', score: 0.95 }
   * );
   *
   * @example
   * // Delete a key
   * const updated = await client.sessions.patchMessageMeta(
   *   sessionId, messageId,
   *   { old_key: null }  // Deletes "old_key"
   * );
   */
  async patchMessageMeta(
    sessionId: string,
    messageId: string,
    meta: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const payload = { meta };
    const data = await this.requester.request('PATCH', `/session/${sessionId}/messages/${messageId}/meta`, {
      jsonData: payload,
    });
    return (data as { meta: Record<string, unknown> }).meta ?? {};
  }

  /**
   * Update session configs using patch semantics.
   *
   * Only updates keys present in the configs object. Existing keys not in the request
   * are preserved. To delete a key, pass null as its value.
   *
   * @param sessionId - The UUID of the session.
   * @param configs - Object of config keys to add, update, or delete. Pass null as a value to delete that key.
   * @returns The complete configs after the patch operation.
   *
   * @example
   * // Add/update keys
   * const updated = await client.sessions.patchConfigs(
   *   sessionId,
   *   { agent: 'bot2', temperature: 0.8 }
   * );
   *
   * @example
   * // Delete a key
   * const updated = await client.sessions.patchConfigs(
   *   sessionId,
   *   { old_key: null }  // Deletes "old_key"
   * );
   */
  async patchConfigs(
    sessionId: string,
    configs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const payload = { configs };
    const data = await this.requester.request('PATCH', `/session/${sessionId}/configs`, {
      jsonData: payload,
    });
    return (data as { configs: Record<string, unknown> }).configs ?? {};
  }

  /**
   * Fork (duplicate) a session with all its messages and tasks.
   *
   * Creates a complete copy of the session including all messages, tasks, and configurations.
   * The forked session will be independent and modifications to it won't affect the original.
   *
   * @param sessionId - The UUID of the session to fork.
   * @returns ForkSessionResult containing the original and new session IDs.
   * @throws {Error} If session_id is invalid or session doesn't exist.
   * @throws {Error} If session exceeds maximum forkable size (5000 messages).
   *
   * @example
   * const result = await client.sessions.fork(sessionId);
   * console.log(`Forked session: ${result.newSessionId}`);
   * console.log(`Original session: ${result.oldSessionId}`);
   */
  async fork(sessionId: string): Promise<ForkSessionResult> {
    validateUUID(sessionId, 'sessionId');
    const data = await this.requester.request('POST', `/session/${sessionId}/fork`);
    return ForkSessionResultSchema.parse(data);
  }
}

/**
 * Claude Agent SDK integration for Acontext.
 *
 * Provides {@link ClaudeAgentStorage} that accepts messages produced by the
 * Claude Agent SDK `query()` async iterable and persists **only** user and
 * assistant messages to Acontext in Anthropic format via
 * `client.sessions.storeMessage(...)`.
 *
 * Other message types (system, result, stream_event, etc.) are used only for
 * session-id resolution and are **never** stored.
 *
 * Usage:
 * ```typescript
 * import { AcontextClient, ClaudeAgentStorage } from '@acontext/acontext';
 * import { query } from '@anthropic-ai/claude-agent-sdk';
 *
 * const client = new AcontextClient({ apiKey: 'sk-ac-your-api-key' });
 * const storage = new ClaudeAgentStorage({ client });
 *
 * for await (const message of query({ prompt: 'Hello' })) {
 *   await storage.saveMessage(message);
 * }
 * ```
 */

import { APIError } from '../errors';

// ---------------------------------------------------------------------------
// Duck-typed client interface
// ---------------------------------------------------------------------------

/**
 * Minimal duck-typed interface for the Acontext client.
 * Both `AcontextClient` and `MockAcontextClient` satisfy this interface.
 */
export interface AcontextClientLike {
  sessions: {
    create(options?: {
      useUuid?: string | null;
      user?: string | null;
    }): Promise<{ id: string }>;
    storeMessage(
      sessionId: string,
      blob: Record<string, unknown>,
      options?: {
        format?: string;
        meta?: Record<string, unknown> | null;
      }
    ): Promise<unknown>;
  };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for constructing a {@link ClaudeAgentStorage} instance.
 */
export interface ClaudeAgentStorageOptions {
  /** An Acontext client instance (or any object satisfying `AcontextClientLike`). */
  client: AcontextClientLike;
  /** Acontext session UUID. If omitted, discovered from the Claude stream or auto-created. */
  sessionId?: string;
  /** Optional user identifier passed to `sessions.create()`. */
  user?: string;
  /** Whether to store ThinkingBlock content as native thinking blocks. Default: false. */
  includeThinking?: boolean;
  /**
   * Optional error callback invoked when `storeMessage` raises.
   * Receives `(error, blob)` where `blob` is the **converted** Anthropic blob.
   * If not provided, errors are logged via `console.warn`.
   */
  onError?: (error: Error, blob: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Helpers – message type detection (TS Claude Agent SDK uses `type` field)
// ---------------------------------------------------------------------------

/**
 * Check if a message is a storable user message.
 * Skips replay messages (`isReplay === true`) which are TS-only.
 */
function isUserMessage(msg: Record<string, unknown>): boolean {
  return msg.type === 'user' && !msg.isReplay;
}

/**
 * Check if a message is a storable assistant message.
 */
function isAssistantMessage(msg: Record<string, unknown>): boolean {
  return msg.type === 'assistant';
}

/**
 * Check if a message is a replay user message (TS-only).
 */
function isReplayMessage(msg: Record<string, unknown>): boolean {
  return msg.type === 'user' && msg.isReplay === true;
}

// ---------------------------------------------------------------------------
// Helpers – session id extraction
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Return `sid` if it is a valid UUID, otherwise warn and return `null`.
 */
function validateSessionId(sid: string): string | null {
  if (!UUID_RE.test(sid)) {
    console.warn(
      `Ignoring non-UUID session_id from Claude stream: "${sid}"`
    );
    return null;
  }
  return sid;
}

/**
 * Try to extract a Claude session id from a non-storable message.
 *
 * In the TS Claude Agent SDK, `session_id` is a flat field on system,
 * result, stream_event, and other non-storable message types.
 *
 * Returns `null` when the message does not carry a session id or
 * when the extracted value is not a valid UUID format.
 */
export function getSessionIdFromMessage(
  msg: Record<string, unknown>
): string | null {
  // Only extract from non-storable messages
  if (msg.type === 'user' || msg.type === 'assistant') {
    return null;
  }
  const sid = msg.session_id;
  if (typeof sid !== 'string') {
    return null;
  }
  return validateSessionId(sid);
}

// ---------------------------------------------------------------------------
// Helpers – block conversion (Claude SDK → Anthropic blob)
// ---------------------------------------------------------------------------

/**
 * Normalize `ToolResultBlock.content` to a shape accepted by the API.
 *
 * - `null`/`undefined` → `""`
 * - `string` → as-is
 * - `array` → `[{ type: "text", text: item.text ?? "" }]`
 * - other → `String(content)`
 */
function normalizeToolResultContent(
  content: unknown
): string | Array<Record<string, unknown>> {
  if (content === null || content === undefined) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item: Record<string, unknown>) => ({
      type: 'text',
      text: (item as Record<string, unknown>)?.text ?? '',
    }));
  }
  return String(content);
}

/**
 * Convert a single Claude SDK content block to an Anthropic content block.
 *
 * Returns `null` when the block should be skipped.
 */
function convertBlock(
  block: Record<string, unknown>,
  role: string,
  includeThinking: boolean
): Record<string, unknown> | null {
  const blockType = block.type;

  switch (blockType) {
    case 'thinking': {
      if (!includeThinking) {
        return null;
      }
      const thinkingText = block.thinking;
      if (!thinkingText) {
        return null; // empty thinking text
      }
      return {
        type: 'thinking',
        thinking: thinkingText,
        signature: block.signature ?? '',
      };
    }

    case 'tool_use': {
      if (role !== 'assistant') {
        return null; // tool_use only valid in assistant messages
      }
      let inputVal = block.input;
      if (typeof inputVal === 'string') {
        try {
          inputVal = JSON.parse(inputVal);
        } catch {
          inputVal = { raw: inputVal };
        }
      }
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: inputVal,
      };
    }

    case 'tool_result': {
      if (role !== 'user') {
        return null; // tool_result only valid in user messages
      }
      const result: Record<string, unknown> = {
        type: 'tool_result',
        tool_use_id: block.tool_use_id,
        content: normalizeToolResultContent(block.content),
      };
      if (block.is_error) {
        result.is_error = true;
      }
      return result;
    }

    case 'text': {
      const text = block.text;
      if (!text) {
        return null; // empty text
      }
      return { type: 'text', text };
    }

    default:
      // Unknown block type – skip silently
      return null;
  }
}

/**
 * Convert Claude SDK content to Anthropic content block array.
 *
 * Returns `[blocks, hasThinking]` where `hasThinking` is `true` when at
 * least one thinking block was successfully included in the output.
 */
function convertContentBlocks(
  content: unknown,
  role: string,
  includeThinking: boolean
): [Array<Record<string, unknown>>, boolean] {
  let hasThinking = false;

  if (typeof content === 'string') {
    if (!content) {
      return [[], false];
    }
    return [[{ type: 'text', text: content }], false];
  }

  if (!Array.isArray(content)) {
    return [[], false];
  }

  const blocks: Array<Record<string, unknown>> = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) {
      continue; // skip non-object items (matching Python's `if not isinstance(block, dict)`)
    }
    const converted = convertBlock(
      block as Record<string, unknown>,
      role,
      includeThinking
    );
    if (converted !== null) {
      blocks.push(converted);
      // Track whether a thinking block was successfully included
      if (
        (block as Record<string, unknown>).type === 'thinking' &&
        includeThinking
      ) {
        hasThinking = true;
      }
    }
  }

  return [blocks, hasThinking];
}

// ---------------------------------------------------------------------------
// Public conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Claude Agent SDK user message to an Anthropic blob.
 *
 * TS reads `msg.message?.content ?? ""` (nested under API message object).
 *
 * Returns `null` when the resulting content would be empty (no storable blocks).
 */
export function claudeUserMessageToAnthropicBlob(
  msg: Record<string, unknown>
): Record<string, unknown> | null {
  const message = msg.message as Record<string, unknown> | undefined;
  const content = message?.content ?? '';
  const [blocks] = convertContentBlocks(content, 'user', false);
  if (blocks.length === 0) {
    return null;
  }
  return { role: 'user', content: blocks };
}

/**
 * Convert a Claude Agent SDK assistant message to an Anthropic blob.
 *
 * TS reads `msg.message?.content ?? []` (nested under API message object).
 *
 * Returns `{ blob: ... | null, hasThinking: boolean }`.
 */
export function claudeAssistantMessageToAnthropicBlob(
  msg: Record<string, unknown>,
  includeThinking = false
): { blob: Record<string, unknown> | null; hasThinking: boolean } {
  const message = msg.message as Record<string, unknown> | undefined;
  const content = message?.content ?? [];
  const [blocks, hasThinking] = convertContentBlocks(
    content,
    'assistant',
    includeThinking
  );
  if (blocks.length === 0) {
    return { blob: null, hasThinking };
  }
  return {
    blob: { role: 'assistant', content: blocks },
    hasThinking,
  };
}

// ---------------------------------------------------------------------------
// ClaudeAgentStorage
// ---------------------------------------------------------------------------

/**
 * Storage adapter for the Claude Agent SDK (TypeScript).
 *
 * Accepts messages from the `query()` async iterable and persists **only**
 * user and assistant messages to Acontext in Anthropic format.
 */
export class ClaudeAgentStorage {
  private _client: AcontextClientLike;
  private _sessionId: string | null;
  private _user: string | null;
  private _includeThinking: boolean;
  private _onError:
    | ((error: Error, blob: Record<string, unknown>) => void)
    | null;
  private _sessionEnsured = false;

  constructor(options: ClaudeAgentStorageOptions) {
    this._client = options.client;
    this._sessionId = options.sessionId ?? null;
    this._user = options.user ?? null;
    this._includeThinking = options.includeThinking ?? false;
    this._onError = options.onError ?? null;
  }

  // -- properties ----------------------------------------------------------

  /**
   * The current Acontext session id (may be `null` until resolved).
   */
  get sessionId(): string | null {
    return this._sessionId;
  }

  // -- public API ----------------------------------------------------------

  /**
   * Persist a single Claude Agent SDK message to Acontext.
   *
   * - User and assistant messages are stored.
   * - All other message types (system, result, stream_event, etc.) are used
   *   only for session-id resolution and are **not** stored.
   * - Replay messages (`isReplay: true`) are skipped to prevent duplicates.
   * - API errors are caught and either forwarded to `onError` or logged,
   *   so the caller's `for await` loop is never interrupted.
   */
  async saveMessage(msg: Record<string, unknown>): Promise<void> {
    // -- non-storable message types: update session_id only ----------------
    if (msg.type !== 'user' && msg.type !== 'assistant') {
      this._tryUpdateSessionId(msg);
      return;
    }

    // -- replay user message: skip (TS-only) -------------------------------
    if (isReplayMessage(msg)) {
      return;
    }

    // -- storable: assistant or user ---------------------------------------
    if (isAssistantMessage(msg)) {
      return this._storeAssistant(msg);
    }

    if (isUserMessage(msg)) {
      return this._storeUser(msg);
    }

    // Unknown — ignore
  }

  // -- internal helpers ----------------------------------------------------

  private _tryUpdateSessionId(msg: Record<string, unknown>): void {
    if (this._sessionId !== null) {
      return;
    }
    const sid = getSessionIdFromMessage(msg);
    if (sid) {
      this._sessionId = sid;
      console.debug(`Resolved session_id=${sid} from message`);
    }
  }

  // -- private store methods -----------------------------------------------

  private async _storeUser(msg: Record<string, unknown>): Promise<void> {
    const blob = claudeUserMessageToAnthropicBlob(msg);
    if (blob === null) {
      console.debug(
        'UserMessage produced empty content after conversion – skipping.'
      );
      return;
    }
    await this._callStore(blob, null);
  }

  private async _storeAssistant(msg: Record<string, unknown>): Promise<void> {
    const { blob, hasThinking } = claudeAssistantMessageToAnthropicBlob(
      msg,
      this._includeThinking
    );
    if (blob === null) {
      console.debug(
        'AssistantMessage produced empty content after conversion – skipping.'
      );
      return;
    }

    const meta: Record<string, unknown> = {};
    const message = msg.message as Record<string, unknown> | undefined;
    const model = message?.model;
    if (model) {
      meta.model = model;
    }
    if (hasThinking) {
      meta.has_thinking = true;
    }
    const error = msg.error;
    if (error) {
      meta.error = error;
    }

    await this._callStore(
      blob,
      Object.keys(meta).length > 0 ? meta : null
    );
  }

  private async _ensureSession(): Promise<void> {
    if (this._sessionEnsured) {
      return;
    }
    try {
      const session = await this._client.sessions.create({
        useUuid: this._sessionId ? this._sessionId : null,
        user: this._user,
      });
      this._sessionId = session.id;
      console.debug(`Created Acontext session ${this._sessionId}`);
    } catch (err) {
      if (err instanceof APIError && err.statusCode === 409) {
        console.debug(
          `Session ${this._sessionId} already exists (409) – continuing.`
        );
      } else {
        throw err;
      }
    }
    this._sessionEnsured = true;
  }

  private async _callStore(
    blob: Record<string, unknown>,
    meta: Record<string, unknown> | null
  ): Promise<void> {
    try {
      await this._ensureSession();
      await this._client.sessions.storeMessage(this._sessionId!, blob, {
        format: 'anthropic',
        meta,
      });
    } catch (err) {
      if (this._onError) {
        this._onError(err as Error, blob);
      } else {
        console.warn(
          `Failed to store message (session=${this._sessionId}):`,
          err
        );
      }
    }
  }
}

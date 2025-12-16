/**
 * Type definitions for session, message, and task resources.
 */

import { z } from 'zod';

export const AssetSchema = z.object({
  bucket: z.string(),
  s3_key: z.string(),
  etag: z.string(),
  sha256: z.string(),
  mime: z.string(),
  size_b: z.number(),
});

export type Asset = z.infer<typeof AssetSchema>;

export const PartSchema = z.object({
  type: z.string(),
  text: z.string().nullable().optional(),
  asset: AssetSchema.nullable().optional(),
  filename: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type Part = z.infer<typeof PartSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  parent_id: z.string().nullable(),
  role: z.string(),
  meta: z.record(z.string(), z.unknown()),
  parts: z.array(PartSchema),
  task_id: z.string().nullable(),
  session_task_process_status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  disable_task_tracking: z.boolean(),
  space_id: z.string().nullable(),
  configs: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  project_id: z.string(),
  order: z.number(),
  data: z.record(z.string(), z.unknown()),
  status: z.string(),
  is_planning: z.boolean(),
  space_digested: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

export const ListSessionsOutputSchema = z.object({
  items: z.array(SessionSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListSessionsOutput = z.infer<typeof ListSessionsOutputSchema>;

export const PublicURLSchema = z.object({
  url: z.string(),
  expire_at: z.string(),
});

export type PublicURL = z.infer<typeof PublicURLSchema>;

export const GetMessagesOutputSchema = z.object({
  items: z.array(z.unknown()),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
  public_urls: z.record(z.string(), PublicURLSchema).nullable().optional(),
});

export type GetMessagesOutput = z.infer<typeof GetMessagesOutputSchema>;

export const GetTasksOutputSchema = z.object({
  items: z.array(TaskSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type GetTasksOutput = z.infer<typeof GetTasksOutputSchema>;

export const LearningStatusSchema = z.object({
  space_digested_count: z.number(),
  not_space_digested_count: z.number(),
});

export type LearningStatus = z.infer<typeof LearningStatusSchema>;

export const TokenCountsSchema = z.object({
  total_tokens: z.number(),
});

export type TokenCounts = z.infer<typeof TokenCountsSchema>;

/**
 * Parameters for the remove_tool_result edit strategy.
 */
export const RemoveToolResultParamsSchema = z.object({
  /**
   * Number of most recent tool results to keep with original content.
   * @default 3
   */
  keep_recent_n_tool_results: z.number().optional(),

  /**
   * Custom text to replace old tool results with.
   * @default "Done"
   */
  tool_result_placeholder: z.string().optional(),
});

export type RemoveToolResultParams = z.infer<typeof RemoveToolResultParamsSchema>;

/**
 * Parameters for the remove_tool_call_params edit strategy.
 */
export const RemoveToolCallParamsParamsSchema = z.object({
  /**
   * Number of most recent tool calls to keep with full parameters.
   * @default 3
   */
  keep_recent_n_tool_calls: z.number().optional(),
});
export type RemoveToolCallParamsParams = z.infer<typeof RemoveToolCallParamsParamsSchema>;

/**
 * Edit strategy to remove parameters from old tool-call parts.
 * 
 * Keeps the most recent N tool calls with full parameters, replacing older
 * tool call arguments with empty JSON "{}". The tool call ID and name remain
 * intact so tool-results can still reference them.
 * 
 * Example: { type: 'remove_tool_call_params', params: { keep_recent_n_tool_calls: 5 } }
 */
export const RemoveToolCallParamsStrategySchema = z.object({
  type: z.literal('remove_tool_call_params'),
  params: RemoveToolCallParamsParamsSchema,
});
export type RemoveToolCallParamsStrategy = z.infer<typeof RemoveToolCallParamsStrategySchema>;

/**
 * Edit strategy to replace old tool results with placeholder text.
 * 
 * Example: { type: 'remove_tool_result', params: { keep_recent_n_tool_results: 5, tool_result_placeholder: 'Cleared' } }
 */
export const RemoveToolResultStrategySchema = z.object({
  type: z.literal('remove_tool_result'),
  params: RemoveToolResultParamsSchema,
});

export type RemoveToolResultStrategy = z.infer<typeof RemoveToolResultStrategySchema>;

/**
 * Parameters for the token_limit edit strategy.
 */
export const TokenLimitParamsSchema = z.object({
  /**
   * Maximum number of tokens to keep. Required parameter.
   * Messages will be removed from oldest to newest until total tokens <= limit_tokens.
   * Tool-call and tool-result pairs are always removed together.
   */
  limit_tokens: z.number(),
});

export type TokenLimitParams = z.infer<typeof TokenLimitParamsSchema>;

/**
 * Edit strategy to truncate messages based on token count.
 * 
 * Removes oldest messages until the total token count is within the specified limit.
 * Maintains tool-call/tool-result pairing - when removing a message with tool-calls,
 * the corresponding tool-result messages are also removed.
 * 
 * Example: { type: 'token_limit', params: { limit_tokens: 20000 } }
 */
export const TokenLimitStrategySchema = z.object({
  type: z.literal('token_limit'),
  params: TokenLimitParamsSchema,
});

export type TokenLimitStrategy = z.infer<typeof TokenLimitStrategySchema>;

/**
 * Union schema for all edit strategies.
 * When adding new strategies, extend this union: z.union([RemoveToolResultStrategySchema, OtherStrategySchema, ...])
 */
export const EditStrategySchema = z.union([
  RemoveToolResultStrategySchema,
  RemoveToolCallParamsStrategySchema,
  TokenLimitStrategySchema,
]);

export type EditStrategy = z.infer<typeof EditStrategySchema>;


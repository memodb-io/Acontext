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


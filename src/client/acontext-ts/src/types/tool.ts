/**
 * Type definitions for tool resources.
 */

import { z } from 'zod';

export const ToolSchemaFormatSchema = z.enum(['openai', 'anthropic', 'gemini']);
export type ToolSchemaFormat = z.infer<typeof ToolSchemaFormatSchema>;

export const ToolSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  user_id: z.string().nullable().optional(),
  name: z.string(),
  description: z.string(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  schema: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Tool = z.infer<typeof ToolSchema>;

export const ListToolsOutputSchema = z.object({
  items: z.array(ToolSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListToolsOutput = z.infer<typeof ListToolsOutputSchema>;

export const ToolSearchHitSchema = z.object({
  tool: ToolSchema,
  distance: z.number(),
});

export type ToolSearchHit = z.infer<typeof ToolSearchHitSchema>;

export const SearchToolsOutputSchema = z.object({
  items: z.array(ToolSearchHitSchema),
});

export type SearchToolsOutput = z.infer<typeof SearchToolsOutputSchema>;


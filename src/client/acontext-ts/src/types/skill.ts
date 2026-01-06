/**
 * Type definitions for skill resources.
 */

import { z } from 'zod';

export const SkillSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  description: z.string(),
  file_index: z.array(z.string()),
  meta: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Skill = z.infer<typeof SkillSchema>;

export const ListSkillsOutputSchema = z.object({
  items: z.array(SkillSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListSkillsOutput = z.infer<typeof ListSkillsOutputSchema>;

export const FileContentSchema = z.object({
  type: z.string(),
  raw: z.string(),
});

export type FileContent = z.infer<typeof FileContentSchema>;

export const GetSkillFileRespSchema = z.object({
  url: z.string().nullable().optional(),
  content: FileContentSchema.nullable().optional(),
});

export type GetSkillFileResp = z.infer<typeof GetSkillFileRespSchema>;


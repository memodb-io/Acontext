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

export const GetSkillFileURLRespSchema = z.object({
  url: z.string(),
});

export type GetSkillFileURLResp = z.infer<typeof GetSkillFileURLRespSchema>;


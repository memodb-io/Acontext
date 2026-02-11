/**
 * Type definitions for learning space resources.
 */

import { z } from 'zod';

export const LearningSpaceSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type LearningSpace = z.infer<typeof LearningSpaceSchema>;

export const LearningSpaceSkillSchema = z.object({
  id: z.string(),
  learning_space_id: z.string(),
  skill_id: z.string(),
  created_at: z.string(),
});

export type LearningSpaceSkill = z.infer<typeof LearningSpaceSkillSchema>;

export const LearningSpaceSessionSchema = z.object({
  id: z.string(),
  learning_space_id: z.string(),
  session_id: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type LearningSpaceSession = z.infer<typeof LearningSpaceSessionSchema>;

export const ListLearningSpacesOutputSchema = z.object({
  items: z.array(LearningSpaceSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListLearningSpacesOutput = z.infer<typeof ListLearningSpacesOutputSchema>;

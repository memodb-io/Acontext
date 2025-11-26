/**
 * Type definitions for space resources.
 */

import { z } from 'zod';

export const SpaceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  configs: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Space = z.infer<typeof SpaceSchema>;

export const ListSpacesOutputSchema = z.object({
  items: z.array(SpaceSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListSpacesOutput = z.infer<typeof ListSpacesOutputSchema>;

export const SearchResultBlockItemSchema = z.object({
  block_id: z.string(),
  title: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  distance: z.number().nullable(),
});

export type SearchResultBlockItem = z.infer<typeof SearchResultBlockItemSchema>;

export const SpaceSearchResultSchema = z.object({
  cited_blocks: z.array(SearchResultBlockItemSchema),
  final_answer: z.string().nullable().optional(),
});

export type SpaceSearchResult = z.infer<typeof SpaceSearchResultSchema>;

export const ExperienceConfirmationSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  task_id: z.string().nullable().optional(),
  experience_data: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ExperienceConfirmation = z.infer<typeof ExperienceConfirmationSchema>;

export const ListExperienceConfirmationsOutputSchema = z.object({
  items: z.array(ExperienceConfirmationSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListExperienceConfirmationsOutput = z.infer<typeof ListExperienceConfirmationsOutputSchema>;


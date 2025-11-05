/**
 * Type definitions for space resources.
 */

import { z } from 'zod';

export const SpaceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  configs: z.record(z.unknown()),
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


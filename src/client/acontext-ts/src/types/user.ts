/**
 * Type definitions for user resources.
 */

import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  identifier: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type User = z.infer<typeof UserSchema>;

export const ListUsersOutputSchema = z.object({
  items: z.array(UserSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListUsersOutput = z.infer<typeof ListUsersOutputSchema>;

export const UserResourceCountsSchema = z.object({
  sessions_count: z.number(),
  disks_count: z.number(),
  skills_count: z.number(),
  tools_count: z.number(),
});

export type UserResourceCounts = z.infer<typeof UserResourceCountsSchema>;

export const GetUserResourcesOutputSchema = z.object({
  counts: UserResourceCountsSchema,
});

export type GetUserResourcesOutput = z.infer<typeof GetUserResourcesOutputSchema>;

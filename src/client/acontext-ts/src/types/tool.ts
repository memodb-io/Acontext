/**
 * Type definitions for tool resources.
 */

import { z } from 'zod';

export const ToolRenameItemSchema = z.object({
  oldName: z.string(),
  newName: z.string(),
});

export type ToolRenameItem = z.infer<typeof ToolRenameItemSchema>;

export const ToolReferenceDataSchema = z.object({
  name: z.string(),
  sop_count: z.number(),
});

export type ToolReferenceData = z.infer<typeof ToolReferenceDataSchema>;

export const FlagResponseSchema = z.object({
  status: z.number(),
  errmsg: z.string(),
});

export type FlagResponse = z.infer<typeof FlagResponseSchema>;


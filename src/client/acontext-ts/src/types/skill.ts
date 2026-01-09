/**
 * Type definitions for skill resources.
 */

import { z } from 'zod';

import { FileContentSchema } from './common';

export const FileInfoSchema = z.object({
  path: z.string(),
  mime: z.string(),
});

export type FileInfo = z.infer<typeof FileInfoSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  file_index: z.array(FileInfoSchema),
  meta: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Skill = z.infer<typeof SkillSchema>;

export const SkillCatalogItemSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type SkillCatalogItem = z.infer<typeof SkillCatalogItemSchema>;

export const ListSkillsOutputSchema = z.object({
  items: z.array(SkillCatalogItemSchema),
  total: z.number(),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListSkillsOutput = z.infer<typeof ListSkillsOutputSchema>;

export const GetSkillFileRespSchema = z.object({
  path: z.string(),
  mime: z.string(),
  url: z.string().nullable().optional(),
  content: FileContentSchema.nullable().optional(),
});

export type GetSkillFileResp = z.infer<typeof GetSkillFileRespSchema>;


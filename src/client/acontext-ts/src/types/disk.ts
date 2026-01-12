/**
 * Type definitions for disk and artifact resources.
 */

import { z } from 'zod';

import { FileContentSchema } from './common';

export const DiskSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Disk = z.infer<typeof DiskSchema>;

export const ListDisksOutputSchema = z.object({
  items: z.array(DiskSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type ListDisksOutput = z.infer<typeof ListDisksOutputSchema>;

export const ArtifactSchema = z.object({
  disk_id: z.string(),
  path: z.string(),
  filename: z.string(),
  meta: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

export const GetArtifactRespSchema = z.object({
  artifact: ArtifactSchema,
  public_url: z.string().nullable().optional(),
  content: FileContentSchema.nullable().optional(),
});

export type GetArtifactResp = z.infer<typeof GetArtifactRespSchema>;

export const ListArtifactsRespSchema = z.object({
  artifacts: z.array(ArtifactSchema),
  directories: z.array(z.string()),
});

export type ListArtifactsResp = z.infer<typeof ListArtifactsRespSchema>;

export const UpdateArtifactRespSchema = z.object({
  artifact: ArtifactSchema,
});

export type UpdateArtifactResp = z.infer<typeof UpdateArtifactRespSchema>;


/**
 * Project configuration types.
 */

import { z } from 'zod';

export const ProjectConfigSchema = z
  .object({
    task_success_criteria: z.string().nullable().optional(),
    task_failure_criteria: z.string().nullable().optional(),
  })
  .passthrough();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export type ProjectConfigUpdate = Partial<ProjectConfig>;

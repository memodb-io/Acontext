/**
 * Common type definitions shared across modules.
 */

import { z } from 'zod';

export const FileContentSchema = z.object({
  type: z.string(),
  raw: z.string(),
});

export type FileContent = z.infer<typeof FileContentSchema>;


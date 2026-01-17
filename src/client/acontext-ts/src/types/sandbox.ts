/**
 * Type definitions for sandbox resources.
 */

import { z } from 'zod';

export const SandboxRuntimeInfoSchema = z.object({
  sandbox_id: z.string(),
  sandbox_status: z.string(),
  sandbox_created_at: z.string(),
  sandbox_expires_at: z.string(),
});

export type SandboxRuntimeInfo = z.infer<typeof SandboxRuntimeInfoSchema>;

export const SandboxCommandOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exit_code: z.number(),
});

export type SandboxCommandOutput = z.infer<typeof SandboxCommandOutputSchema>;

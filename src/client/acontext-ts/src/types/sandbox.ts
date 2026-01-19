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

export const HistoryCommandSchema = z.object({
  command: z.string(),
  exit_code: z.number(),
});

export type HistoryCommand = z.infer<typeof HistoryCommandSchema>;

export const GeneratedFileSchema = z.object({
  sandbox_path: z.string(),
});

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

export const SandboxLogSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  backend_sandbox_id: z.string().nullable().optional(),
  backend_type: z.string(),
  history_commands: z.array(HistoryCommandSchema),
  generated_files: z.array(GeneratedFileSchema),
  will_total_alive_seconds: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SandboxLog = z.infer<typeof SandboxLogSchema>;

export const GetSandboxLogsOutputSchema = z.object({
  items: z.array(SandboxLogSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export type GetSandboxLogsOutput = z.infer<typeof GetSandboxLogsOutputSchema>;

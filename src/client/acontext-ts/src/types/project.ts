/**
 * Project configuration types.
 */

export interface ProjectConfig {
  task_success_criteria?: string | null;
  task_failure_criteria?: string | null;
  [key: string]: unknown;
}

export type ProjectConfigUpdate = Partial<ProjectConfig>;

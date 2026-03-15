/**
 * Project configuration operations mixin
 */

import type { Constructor, BaseClient } from "./base";

export interface ProjectConfig {
  task_success_criteria?: string | null;
  task_failure_criteria?: string | null;
  [key: string]: unknown;
}

export function ProjectConfigOperations<T extends Constructor<BaseClient>>(
  Base: T
) {
  return class extends Base {
    /**
     * Get project-level configuration
     */
    async getProjectConfigs(projectId: string): Promise<ProjectConfig> {
      return await this.request<ProjectConfig>("/api/v1/project/configs", {
        projectId,
      });
    }

    /**
     * Update project-level configuration by merging keys.
     * Keys with null values are deleted (reset to default).
     */
    async updateProjectConfigs(
      projectId: string,
      configs: Partial<ProjectConfig>
    ): Promise<ProjectConfig> {
      return await this.request<ProjectConfig>("/api/v1/project/configs", {
        method: "PATCH",
        projectId,
        body: JSON.stringify(configs),
      });
    }
  };
}

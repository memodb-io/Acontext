/**
 * Project configuration endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { ProjectConfig, ProjectConfigSchema, ProjectConfigUpdate } from '../types/project';

export class ProjectAPI {
  constructor(private requester: RequesterProtocol) {}

  /**
   * Get the project-level configuration.
   *
   * @returns ProjectConfig containing the current project configuration
   */
  async getConfigs(): Promise<ProjectConfig> {
    const data = await this.requester.request('GET', '/project/configs');
    return ProjectConfigSchema.parse(data);
  }

  /**
   * Update the project-level configuration by merging keys.
   * Keys with null values are deleted (reset to default).
   *
   * @param configs - Configuration keys to merge
   * @returns ProjectConfig containing the updated project configuration
   */
  async updateConfigs(configs: ProjectConfigUpdate): Promise<ProjectConfig> {
    const data = await this.requester.request('PATCH', '/project/configs', {
      jsonData: configs,
    });
    return ProjectConfigSchema.parse(data);
  }
}

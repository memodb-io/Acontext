/**
 * User management endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { buildParams } from '../utils';
import {
  GetUserResourcesOutput,
  GetUserResourcesOutputSchema,
  ListUsersOutput,
  ListUsersOutputSchema,
} from '../types';

export class UsersAPI {
  constructor(private requester: RequesterProtocol) {}

  /**
   * List all users in the project.
   *
   * @param options - Optional parameters for listing users
   * @param options.limit - Maximum number of users to return. If not provided or 0, all users will be returned.
   * @param options.cursor - Cursor for pagination
   * @param options.timeDesc - Order by created_at descending if true, ascending if false
   * @returns ListUsersOutput containing the list of users and pagination information
   */
  async list(options?: {
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListUsersOutput> {
    const params = buildParams({
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', '/user/ls', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListUsersOutputSchema.parse(data);
  }

  /**
   * Get resource counts for a user.
   *
   * @param identifier - The user identifier string
   * @returns GetUserResourcesOutput containing counts for Sessions, Disks, and Skills
   */
  async getResources(identifier: string): Promise<GetUserResourcesOutput> {
    const data = await this.requester.request(
      'GET',
      `/user/${encodeURIComponent(identifier)}/resources`
    );
    return GetUserResourcesOutputSchema.parse(data);
  }

  /**
   * Delete a user and cascade delete all associated resources (Session, Disk, Skill).
   *
   * @param identifier - The user identifier string
   */
  async delete(identifier: string): Promise<void> {
    await this.requester.request('DELETE', `/user/${encodeURIComponent(identifier)}`);
  }
}

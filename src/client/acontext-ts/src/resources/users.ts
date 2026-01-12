/**
 * User management endpoints.
 */

import { RequesterProtocol } from '../client-types';

export class UsersAPI {
  constructor(private requester: RequesterProtocol) {}

  /**
   * Delete a user and cascade delete all associated resources (Space, Session, Disk, Skill).
   *
   * @param identifier - The user identifier string
   */
  async delete(identifier: string): Promise<void> {
    await this.requester.request('DELETE', `/user/${encodeURIComponent(identifier)}`);
  }
}

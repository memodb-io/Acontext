/**
 * Sandboxes endpoints.
 */

import { RequesterProtocol } from '../client-types';
import {
  FlagResponse,
  FlagResponseSchema,
  SandboxCommandOutput,
  SandboxCommandOutputSchema,
  SandboxRuntimeInfo,
  SandboxRuntimeInfoSchema,
} from '../types';

export class SandboxesAPI {
  constructor(private requester: RequesterProtocol) {}

  /**
   * Create and start a new sandbox.
   *
   * @returns SandboxRuntimeInfo containing the sandbox ID, status, and timestamps
   */
  async create(): Promise<SandboxRuntimeInfo> {
    const data = await this.requester.request('POST', '/sandbox');
    return SandboxRuntimeInfoSchema.parse(data);
  }

  /**
   * Execute a shell command in the sandbox.
   *
   * @param options - Command execution options
   * @param options.sandboxId - The UUID of the sandbox
   * @param options.command - The shell command to execute
   * @returns SandboxCommandOutput containing stdout, stderr, and exit code
   */
  async execCommand(options: {
    sandboxId: string;
    command: string;
  }): Promise<SandboxCommandOutput> {
    const data = await this.requester.request(
      'POST',
      `/sandbox/${options.sandboxId}/exec`,
      {
        jsonData: { command: options.command },
      }
    );
    return SandboxCommandOutputSchema.parse(data);
  }

  /**
   * Kill a running sandbox.
   *
   * @param sandboxId - The UUID of the sandbox to kill
   * @returns FlagResponse with status and error message
   */
  async kill(sandboxId: string): Promise<FlagResponse> {
    const data = await this.requester.request(
      'DELETE',
      `/sandbox/${sandboxId}`
    );
    return FlagResponseSchema.parse(data);
  }
}

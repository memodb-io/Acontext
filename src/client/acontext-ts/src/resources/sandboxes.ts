/**
 * Sandboxes endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { buildParams } from '../utils';
import {
  FlagResponse,
  FlagResponseSchema,
  GetSandboxLogsOutput,
  GetSandboxLogsOutputSchema,
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
   * @param options.timeout - Optional timeout in milliseconds for this command.
   *                          If not provided, uses the client's default timeout.
   * @returns SandboxCommandOutput containing stdout, stderr, and exit code
   */
  async execCommand(options: {
    sandboxId: string;
    command: string;
    timeout?: number;
  }): Promise<SandboxCommandOutput> {
    const data = await this.requester.request(
      'POST',
      `/sandbox/${options.sandboxId}/exec`,
      {
        jsonData: { command: options.command },
        timeout: options.timeout,
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

  /**
   * Get sandbox logs for the project with cursor-based pagination.
   *
   * @param options - Optional parameters for retrieving logs
   * @param options.limit - Maximum number of logs to return (default 20, max 200)
   * @param options.cursor - Cursor for pagination. Use the cursor from the previous response to get the next page
   * @param options.timeDesc - Order by created_at descending if true, ascending if false (default false)
   * @returns GetSandboxLogsOutput containing the list of sandbox logs and pagination information
   */
  async getLogs(options?: {
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<GetSandboxLogsOutput> {
    const params = buildParams({
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', '/sandbox/logs', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return GetSandboxLogsOutputSchema.parse(data);
  }
}

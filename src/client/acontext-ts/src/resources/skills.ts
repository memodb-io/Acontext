/**
 * Skills endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { FileUpload, normalizeFileUpload } from '../uploads';
import { buildParams } from '../utils';
import {
  DownloadSkillToSandboxResp,
  DownloadSkillToSandboxRespSchema,
  GetSkillFileResp,
  GetSkillFileRespSchema,
  ListSkillsOutput,
  ListSkillsOutputSchema,
  Skill,
  SkillSchema,
} from '../types';

export class SkillsAPI {
  constructor(private requester: RequesterProtocol) { }

  async create(options: {
    file:
    | FileUpload
    | [string, Buffer | NodeJS.ReadableStream]
    | [string, Buffer | NodeJS.ReadableStream, string | null];
    user?: string | null;
    meta?: Record<string, unknown> | null;
  }): Promise<Skill> {
    const upload = normalizeFileUpload(options.file);
    const files = {
      file: upload.asFormData(),
    };
    const form: Record<string, string> = {};
    if (options.user !== undefined && options.user !== null) {
      form.user = options.user;
    }
    if (options.meta !== undefined && options.meta !== null) {
      form.meta = JSON.stringify(options.meta);
    }
    const data = await this.requester.request('POST', '/agent_skills', {
      data: Object.keys(form).length > 0 ? form : undefined,
      files,
    });
    return SkillSchema.parse(data);
  }

  /**
   * Get a catalog of skills (names and descriptions only) with pagination.
   *
   * @param options - Pagination options
   * @param options.user - Filter by user identifier (optional)
   * @param options.limit - Maximum number of skills per page (defaults to 100, max 200)
   * @param options.cursor - Cursor for pagination to fetch the next page (optional)
   * @param options.timeDesc - Order by created_at descending if true, ascending if false (defaults to false)
   * @returns ListSkillsOutput containing skills with name and description for the current page,
   *          along with pagination information (next_cursor and has_more)
   */
  async listCatalog(options?: {
    user?: string | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListSkillsOutput> {
    // Use 100 as default for catalog listing (only name and description, lightweight)
    const effectiveLimit = options?.limit ?? 100;
    const params = buildParams({
      user: options?.user ?? null,
      limit: effectiveLimit,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', '/agent_skills', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    // Zod strips unknown keys, so ListSkillsOutputSchema extracts only name/description
    return ListSkillsOutputSchema.parse(data);
  }

  /**
   * Get a skill by its ID.
   *
   * @param skillId - The UUID of the skill
   * @returns Skill containing the full skill information including file_index
   */
  async get(skillId: string): Promise<Skill> {
    const data = await this.requester.request('GET', `/agent_skills/${skillId}`);
    return SkillSchema.parse(data);
  }

  async delete(skillId: string): Promise<void> {
    await this.requester.request('DELETE', `/agent_skills/${skillId}`);
  }

  /**
   * Get a file from a skill by skill ID.
   *
   * The backend automatically returns content for parseable text files, or a presigned URL
   * for non-parseable files (binary, images, etc.).
   *
   * @param options - File retrieval options
   * @param options.skillId - The UUID of the skill
   * @param options.filePath - Relative path to the file within the skill (e.g., 'scripts/extract_text.json')
   * @param options.expire - URL expiration time in seconds (defaults to 900 / 15 minutes)
   * @returns GetSkillFileResp containing the file path, MIME type, and either content or URL
   */
  async getFile(options: {
    skillId: string;
    filePath: string;
    expire?: number | null;
  }): Promise<GetSkillFileResp> {
    const endpoint = `/agent_skills/${options.skillId}/file`;

    const params: Record<string, string | number> = {
      file_path: options.filePath,
    };
    if (options.expire !== undefined && options.expire !== null) {
      params.expire = options.expire;
    }

    const data = await this.requester.request('GET', endpoint, {
      params,
    });

    return GetSkillFileRespSchema.parse(data);
  }

  /**
   * Download all files from a skill to a sandbox environment.
   *
   * Files are placed at /skills/{skillName}/.
   *
   * @param skillId - The UUID of the skill to download
   * @param options - Download options
   * @param options.sandboxId - The UUID of the target sandbox
   * @returns DownloadSkillToSandboxResp containing success status, directory path, skill name and description
   */
  async downloadToSandbox(
    skillId: string,
    options: {
      sandboxId: string;
    }
  ): Promise<DownloadSkillToSandboxResp> {
    const payload: Record<string, string> = {
      sandbox_id: options.sandboxId,
    };

    const data = await this.requester.request(
      'POST',
      `/agent_skills/${skillId}/download_to_sandbox`,
      { jsonData: payload }
    );

    return DownloadSkillToSandboxRespSchema.parse(data);
  }
}


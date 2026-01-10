/**
 * Skills endpoints.
 */

import { z } from 'zod';

import { RequesterProtocol } from '../client-types';
import { FileUpload, normalizeFileUpload } from '../uploads';
import { buildParams } from '../utils';
import {
  GetSkillFileResp,
  GetSkillFileRespSchema,
  ListSkillsOutput,
  ListSkillsOutputSchema,
  Skill,
  SkillCatalogItem,
  SkillSchema,
} from '../types';

export class SkillsAPI {
  constructor(private requester: RequesterProtocol) {}

  async create(options: {
    file:
      | FileUpload
      | [string, Buffer | NodeJS.ReadableStream]
      | [string, Buffer | NodeJS.ReadableStream, string | null];
    meta?: Record<string, unknown> | null;
  }): Promise<Skill> {
    const upload = normalizeFileUpload(options.file);
    const files = {
      file: upload.asFormData(),
    };
    const form: Record<string, string> = {};
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
   * @param options.limit - Maximum number of skills per page (defaults to 100, max 200)
   * @param options.cursor - Cursor for pagination to fetch the next page (optional)
   * @param options.timeDesc - Order by created_at descending if true, ascending if false (defaults to false)
   * @returns ListSkillsOutput containing skills with name and description for the current page,
   *          along with pagination information (next_cursor and has_more)
   */
  async list_catalog(options?: {
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListSkillsOutput> {
    // Parse API response (contains full Skill objects)
    const apiResponseSchema = z.object({
      items: z.array(SkillSchema),
      next_cursor: z.string().nullable().optional(),
      has_more: z.boolean(),
    });

    // Use 100 as default for catalog listing (only name and description, lightweight)
    const effectiveLimit = options?.limit ?? 100;
    const params = buildParams({
      limit: effectiveLimit,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', '/agent_skills', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    const apiResponse = apiResponseSchema.parse(data);

    // Convert to catalog format (name and description only)
    return ListSkillsOutputSchema.parse({
      items: apiResponse.items.map(
        (skill): SkillCatalogItem => ({
          name: skill.name,
          description: skill.description,
        })
      ),
      next_cursor: apiResponse.next_cursor ?? null,
      has_more: apiResponse.has_more,
    });
  }

  async getByName(name: string): Promise<Skill> {
    const params = { name };
    const data = await this.requester.request('GET', '/agent_skills/by_name', {
      params,
    });
    return SkillSchema.parse(data);
  }

  async delete(skillId: string): Promise<void> {
    await this.requester.request('DELETE', `/agent_skills/${skillId}`);
  }

  async getFileByName(options: {
    skillName: string;
    filePath: string;
    expire?: number | null;
  }): Promise<GetSkillFileResp> {
    const endpoint = `/agent_skills/by_name/${options.skillName}/file`;

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
}


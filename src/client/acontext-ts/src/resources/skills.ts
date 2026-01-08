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

  async list(options?: {
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

    // Collect all skills across all pages
    const allSkills: Skill[] = [];
    let currentCursor = options?.cursor ?? null;
    const pageLimit = options?.limit ?? 200; // Use max limit to minimize requests

    while (true) {
      const params = buildParams({
        limit: pageLimit,
        cursor: currentCursor,
        time_desc: options?.timeDesc ?? null,
      });
      const data = await this.requester.request('GET', '/agent_skills', {
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      const apiResponse = apiResponseSchema.parse(data);

      allSkills.push(...apiResponse.items);

      // If no more pages, break
      if (!apiResponse.has_more || !apiResponse.next_cursor) {
        break;
      }

      currentCursor = apiResponse.next_cursor;
    }

    // Convert to catalog format (name and description only)
    return ListSkillsOutputSchema.parse({
      items: allSkills.map(
        (skill): SkillCatalogItem => ({
          name: skill.name,
          description: skill.description,
        })
      ),
      total: allSkills.length,
      next_cursor: null, // All results included, no pagination needed
      has_more: false, // All results included
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


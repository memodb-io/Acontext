/**
 * Skills endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { FileUpload, normalizeFileUpload } from '../uploads';
import { buildParams } from '../utils';
import {
  GetSkillFileResp,
  GetSkillFileRespSchema,
  ListSkillsOutput,
  ListSkillsOutputSchema,
  Skill,
  SkillSchema,
} from '../types';

export class SkillsAPI {
  constructor(private requester: RequesterProtocol) {}

  async list(options?: {
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListSkillsOutput> {
    const params = buildParams({
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', '/agent_skills', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListSkillsOutputSchema.parse(data);
  }

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

  async listCatalog(options?: {
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<{
    total: number;
    skills: Array<{ name: string; description: string }>;
  }> {
    const result = await this.list(options);
    return {
      total: result.items.length,
      skills: result.items.map((skill) => ({
        name: skill.name,
        description: skill.description,
      })),
    };
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


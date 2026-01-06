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

  async get(skillId: string): Promise<Skill> {
    const data = await this.requester.request('GET', `/agent_skills/${skillId}`);
    return SkillSchema.parse(data);
  }

  async getByName(name: string): Promise<Skill> {
    const params = { name };
    const data = await this.requester.request('GET', '/agent_skills/by_name', {
      params,
    });
    return SkillSchema.parse(data);
  }

  async update(
    skillId: string,
    options: {
      name?: string | null;
      description?: string | null;
      meta?: Record<string, unknown> | null;
    }
  ): Promise<Skill> {
    const payload: Record<string, unknown> = {};
    if (options.name !== undefined && options.name !== null) {
      payload.name = options.name;
    }
    if (options.description !== undefined && options.description !== null) {
      payload.description = options.description;
    }
    if (options.meta !== undefined && options.meta !== null) {
      payload.meta = options.meta;
    }
    const data = await this.requester.request('PUT', `/agent_skills/${skillId}`, {
      jsonData: payload,
    });
    return SkillSchema.parse(data);
  }

  async delete(skillId: string): Promise<void> {
    await this.requester.request('DELETE', `/agent_skills/${skillId}`);
  }

  async getFile(options: {
    skillId?: string | null;
    skillName?: string | null;
    filePath: string;
    withPublicUrl?: boolean | null;
    withContent?: boolean | null;
    expire?: number | null;
  }): Promise<GetSkillFileResp> {
    if (!options.skillId && !options.skillName) {
      throw new Error('Either skillId or skillName must be provided');
    }

    // Use by_name endpoint if skillName is provided
    const endpoint = options.skillName
      ? `/agent_skills/by_name/${options.skillName}/file`
      : `/agent_skills/${options.skillId}/file`;

    const params: Record<string, string | number | boolean> = {
      file_path: options.filePath,
    };
    if (options.withPublicUrl !== undefined && options.withPublicUrl !== null) {
      params.with_public_url = options.withPublicUrl;
    }
    if (options.withContent !== undefined && options.withContent !== null) {
      params.with_content = options.withContent;
    }
    if (options.expire !== undefined && options.expire !== null) {
      params.expire = options.expire;
    }
    const data = await this.requester.request('GET', endpoint, {
      params,
    });
    return GetSkillFileRespSchema.parse(data);
  }
}


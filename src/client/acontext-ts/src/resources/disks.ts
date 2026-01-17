/**
 * Disk and artifact endpoints.
 */

import { RequesterProtocol } from '../client-types';
import { FileUpload, normalizeFileUpload } from '../uploads';
import { buildParams } from '../utils';
import {
  Artifact,
  ArtifactSchema,
  Artifacts,
  ArtifactsSchema,
  Disk,
  DiskSchema,
  GetArtifactResp,
  GetArtifactRespSchema,
  ListArtifactsResp,
  ListArtifactsRespSchema,
  ListDisksOutput,
  ListDisksOutputSchema,
  UpdateArtifactResp,
  UpdateArtifactRespSchema,
} from '../types';

export class DisksAPI {
  public artifacts: DiskArtifactsAPI;
  private requester: RequesterProtocol;

  constructor(requester: RequesterProtocol) {
    this.requester = requester;
    this.artifacts = new DiskArtifactsAPI(requester);
  }

  async list(options?: {
    user?: string | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
  }): Promise<ListDisksOutput> {
    const params = buildParams({
      user: options?.user ?? null,
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      time_desc: options?.timeDesc ?? null,
    });
    const data = await this.requester.request('GET', '/disk', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListDisksOutputSchema.parse(data);
  }

  async create(options?: {
    user?: string | null;
  }): Promise<Disk> {
    const payload: Record<string, unknown> = {};
    if (options?.user !== undefined && options?.user !== null) {
      payload.user = options.user;
    }
    const data = await this.requester.request('POST', '/disk', {
      jsonData: Object.keys(payload).length > 0 ? payload : undefined,
    });
    return DiskSchema.parse(data);
  }

  async delete(diskId: string): Promise<void> {
    await this.requester.request('DELETE', `/disk/${diskId}`);
  }
}

export class DiskArtifactsAPI {
  constructor(private requester: RequesterProtocol) { }

  async upsert(
    diskId: string,
    options: {
      file:
      | FileUpload
      | [string, Buffer | NodeJS.ReadableStream]
      | [string, Buffer | NodeJS.ReadableStream, string | null];
      filePath?: string | null;
      meta?: Record<string, unknown> | null;
    }
  ): Promise<Artifact> {
    const upload = normalizeFileUpload(options.file);
    const files = {
      file: upload.asFormData(),
    };
    const form: Record<string, string> = {};
    if (options.filePath) {
      form.file_path = options.filePath;
    }
    if (options.meta !== undefined && options.meta !== null) {
      form.meta = JSON.stringify(options.meta);
    }
    const data = await this.requester.request('POST', `/disk/${diskId}/artifact`, {
      data: Object.keys(form).length > 0 ? form : undefined,
      files,
    });
    return ArtifactSchema.parse(data);
  }

  async get(
    diskId: string,
    options: {
      filePath: string;
      filename: string;
      withPublicUrl?: boolean | null;
      withContent?: boolean | null;
      expire?: number | null;
    }
  ): Promise<GetArtifactResp> {
    const fullPath = `${options.filePath.replace(/\/$/, '')}/${options.filename}`;
    const params = buildParams({
      file_path: fullPath,
      with_public_url: options.withPublicUrl ?? null,
      with_content: options.withContent ?? null,
      expire: options.expire ?? null,
    });
    const data = await this.requester.request('GET', `/disk/${diskId}/artifact`, {
      params,
    });
    return GetArtifactRespSchema.parse(data);
  }

  async update(
    diskId: string,
    options: {
      filePath: string;
      filename: string;
      meta: Record<string, unknown>;
    }
  ): Promise<UpdateArtifactResp> {
    const fullPath = `${options.filePath.replace(/\/$/, '')}/${options.filename}`;
    const payload = {
      file_path: fullPath,
      meta: JSON.stringify(options.meta),
    };
    const data = await this.requester.request('PUT', `/disk/${diskId}/artifact`, {
      jsonData: payload,
    });
    return UpdateArtifactRespSchema.parse(data);
  }

  async delete(
    diskId: string,
    options: {
      filePath: string;
      filename: string;
    }
  ): Promise<void> {
    const fullPath = `${options.filePath.replace(/\/$/, '')}/${options.filename}`;
    const params = { file_path: fullPath };
    await this.requester.request('DELETE', `/disk/${diskId}/artifact`, {
      params,
    });
  }

  async list(
    diskId: string,
    options?: {
      path?: string | null;
    }
  ): Promise<ListArtifactsResp> {
    const params: Record<string, string | number> = {};
    if (options?.path !== undefined && options?.path !== null) {
      params.path = options.path;
    }
    const data = await this.requester.request('GET', `/disk/${diskId}/artifact/ls`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListArtifactsRespSchema.parse(data);
  }

  async grepArtifacts(
    diskId: string,
    options: {
      query: string;
      limit?: number;
    }
  ): Promise<Artifacts> {
    const params = buildParams({
      query: options.query,
      limit: options.limit ?? 100,
    });
    const data = await this.requester.request('GET', `/disk/${diskId}/artifact/grep`, {
      params,
    });
    return ArtifactsSchema.parse(data);
  }

  async globArtifacts(
    diskId: string,
    options: {
      query: string;
      limit?: number;
    }
  ): Promise<Artifacts> {
    const params = buildParams({
      query: options.query,
      limit: options.limit ?? 100,
    });
    const data = await this.requester.request('GET', `/disk/${diskId}/artifact/glob`, {
      params,
    });
    return ArtifactsSchema.parse(data);
  }

  async downloadToSandbox(
    diskId: string,
    options: {
      filePath: string;
      filename: string;
      sandboxId: string;
      sandboxPath: string;
    }
  ): Promise<boolean> {
    const payload = {
      file_path: options.filePath,
      filename: options.filename,
      sandbox_id: options.sandboxId,
      sandbox_path: options.sandboxPath,
    };
    const data = await this.requester.request('POST', `/disk/${diskId}/artifact/download_to_sandbox`, {
      jsonData: payload,
    }) as { success?: boolean };
    return Boolean(data?.success);
  }

  async uploadFromSandbox(
    diskId: string,
    options: {
      sandboxId: string;
      sandboxPath: string;
      sandboxFilename: string;
      filePath: string;
    }
  ): Promise<Artifact> {
    const payload = {
      sandbox_id: options.sandboxId,
      sandbox_path: options.sandboxPath,
      sandbox_filename: options.sandboxFilename,
      file_path: options.filePath,
    };
    const data = await this.requester.request('POST', `/disk/${diskId}/artifact/upload_from_sandbox`, {
      jsonData: payload,
    });
    return ArtifactSchema.parse(data);
  }
}

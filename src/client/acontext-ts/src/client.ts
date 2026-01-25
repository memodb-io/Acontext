/**
 * High-level synchronous client for the Acontext API.
 */

import { APIError, TransportError } from './errors';
import { BlocksAPI } from './resources/blocks';
import { DisksAPI } from './resources/disks';
import { SandboxesAPI } from './resources/sandboxes';
import { SessionsAPI } from './resources/sessions';
import { SpacesAPI } from './resources/spaces';
import { ToolsAPI } from './resources/tools';
import { SkillsAPI } from './resources/skills';
import { UsersAPI } from './resources/users';
import { DEFAULT_BASE_URL, DEFAULT_USER_AGENT } from './constants';
import { RequesterProtocol } from './client-types';

export interface AcontextClientOptions {
  apiKey?: string | null;
  baseUrl?: string | null;
  timeout?: number | null;
  userAgent?: string | null;
}

export class AcontextClient implements RequesterProtocol {
  private _baseUrl: string;
  private _apiKey: string;
  private _timeout: number;
  private _userAgent: string;

  public spaces: SpacesAPI;
  public sessions: SessionsAPI;
  public disks: DisksAPI;
  public artifacts: DisksAPI['artifacts'];
  public blocks: BlocksAPI;
  public tools: ToolsAPI;
  public skills: SkillsAPI;
  public users: UsersAPI;
  public sandboxes: SandboxesAPI;

  constructor(options: AcontextClientOptions = {}) {
    // Priority: explicit parameters > environment variables > defaults
    // Load apiKey from parameter or environment variable
    this._apiKey =
      options.apiKey ||
      (typeof process !== 'undefined' && process.env?.ACONTEXT_API_KEY) ||
      '';
    if (!this._apiKey || !this._apiKey.trim()) {
      throw new Error(
        "apiKey is required. Provide it either as a parameter (apiKey='...') " +
        "or set the ACONTEXT_API_KEY environment variable."
      );
    }

    // Load other parameters from environment variables if not provided
    this._baseUrl =
      options.baseUrl ||
      (typeof process !== 'undefined' && process.env?.ACONTEXT_BASE_URL) ||
      DEFAULT_BASE_URL;
    this._baseUrl = this._baseUrl.replace(/\/$/, '');

    this._userAgent =
      options.userAgent ||
      (typeof process !== 'undefined' && process.env?.ACONTEXT_USER_AGENT) ||
      DEFAULT_USER_AGENT;

    this._timeout =
      options.timeout ??
      (typeof process !== 'undefined' && process.env?.ACONTEXT_TIMEOUT
        ? parseFloat(process.env.ACONTEXT_TIMEOUT)
        : 320000);

    this.spaces = new SpacesAPI(this);
    this.sessions = new SessionsAPI(this);
    this.disks = new DisksAPI(this);
    this.artifacts = this.disks.artifacts;
    this.blocks = new BlocksAPI(this);
    this.tools = new ToolsAPI(this);
    this.skills = new SkillsAPI(this);
    this.users = new UsersAPI(this);
    this.sandboxes = new SandboxesAPI(this);
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  /**
   * Ping the API server to check connectivity.
   *
   * @returns Promise resolving to "pong" if the server is reachable and responding.
   * @throws {APIError} If the server returns an error response.
   * @throws {TransportError} If there's a network connectivity issue.
   */
  async ping(): Promise<string> {
    const response = await this.request<{ code: number; msg: string; data?: unknown }>('GET', '/ping', {
      unwrap: false,
    });
    return response.msg || 'pong';
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | number>;
      jsonData?: unknown;
      data?: Record<string, string>;
      files?: Record<string, { filename: string; content: Buffer | NodeJS.ReadableStream; contentType: string }>;
      unwrap?: boolean;
      timeout?: number;
    }
  ): Promise<T> {
    const unwrap = options?.unwrap !== false;
    const url = `${this._baseUrl}${path}`;
    // Use per-request timeout if provided, otherwise use client default
    const effectiveTimeout = options?.timeout ?? this._timeout;

    try {
      // Build headers
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this._apiKey}`,
        Accept: 'application/json',
        'User-Agent': this._userAgent,
      };

      // Build request options
      let body: string | FormData | undefined;
      let requestHeaders = headers;

      if (options?.files) {
        // Use FormData for file uploads
        const FormDataClass = await this.getFormData();
        const formData = new FormDataClass();

        // Add regular form fields
        if (options.data) {
          for (const [key, value] of Object.entries(options.data)) {
            formData.append(key, value);
          }
        }

        // Add files
        for (const [key, file] of Object.entries(options.files)) {
          // Handle Buffer: convert to Blob in browser, use directly in Node.js
          if (file.content instanceof Buffer) {
            // Check if we're in a browser environment (has Blob constructor)
            if (typeof Blob !== 'undefined') {
              // Browser environment: convert Buffer to Blob via Uint8Array
              const uint8Array = new Uint8Array(file.content);
              const blob = new Blob([uint8Array], { type: file.contentType });
              formData.append(key, blob, file.filename);
            } else {
              // Node.js environment: form-data package accepts Buffer directly
              // form-data's append signature differs from browser FormData
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (formData as any).append(key, file.content, {
                filename: file.filename,
                contentType: file.contentType,
              });
            }
          } else {
            // ReadableStream: pass as-is (form-data handles it)
            // form-data's append signature differs from browser FormData
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (formData as any).append(key, file.content, {
              filename: file.filename,
              contentType: file.contentType,
            });
          }
        }

        // FormData type differs between browser and Node.js (form-data package)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body = formData as any;
        // Don't set Content-Type for FormData, let the browser/Node set it with boundary
        delete requestHeaders['Content-Type'];
      } else if (options?.jsonData) {
        body = JSON.stringify(options.jsonData);
        requestHeaders['Content-Type'] = 'application/json';
      } else if (options?.data) {
        // For URL-encoded form data
        const FormDataClass = await this.getFormData();
        const formData = new FormDataClass();
        for (const [key, value] of Object.entries(options.data)) {
          formData.append(key, value);
        }
        // FormData type differs between browser and Node.js (form-data package)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body = formData as any;
        delete requestHeaders['Content-Type'];
      }

      // Build URL with query parameters
      let finalUrl = url;
      if (options?.params && Object.keys(options.params).length > 0) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(options.params)) {
          searchParams.append(key, String(value));
        }
        finalUrl = `${url}?${searchParams.toString()}`;
      }

      // Make the request
      const fetchImpl = await this.getFetch();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

      try {
        const response = await fetchImpl(finalUrl, {
          method,
          headers: requestHeaders,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return await this.handleResponse(response, unwrap);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TransportError(`Request timeout after ${effectiveTimeout}ms`);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof APIError || error instanceof TransportError) {
        throw error;
      }
      throw new TransportError(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleResponse<T>(response: Response, unwrap: boolean): Promise<T> {
    const contentType = response.headers.get('content-type') || '';

    let parsed: unknown = null;
    if (contentType.includes('application/json')) {
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
    }

    if (response.status >= 400) {
      const payload = parsed as Record<string, unknown> | null;
      let message = response.statusText;
      let code: number | undefined;
      let error: string | undefined;

      if (payload && typeof payload === 'object') {
        message = String(payload.msg || payload.message || message);
        error = payload.error as string | undefined;
        const codeVal = payload.code;
        if (typeof codeVal === 'number') {
          code = codeVal;
        }
      }

      throw new APIError({
        statusCode: response.status,
        code,
        message,
        error,
        payload,
      });
    }

    if (parsed === null) {
      if (unwrap) {
        return (await response.text()) as T;
      }
      return {
        code: response.status,
        data: await response.text(),
        msg: response.statusText,
      } as T;
    }

    const payload = parsed as Record<string, unknown>;
    const appCode = payload.code;
    if (typeof appCode === 'number' && appCode >= 400) {
      throw new APIError({
        statusCode: response.status,
        code: appCode,
        message: String(payload.msg || response.statusText),
        error: payload.error as string | undefined,
        payload,
      });
    }

    return (unwrap ? payload.data : payload) as T;
  }

  private async getFetch(): Promise<typeof fetch> {
    // Try to use global fetch if available (Node 18+, modern browsers)
    if (typeof fetch !== 'undefined') {
      return fetch;
    }

    // Fallback to node-fetch for older Node versions
    try {
      // node-fetch is an optional peer dependency, use dynamic import with type assertion
      const nodeFetch = await import('node-fetch' as string) as { default: typeof fetch };
      return nodeFetch.default;
    } catch {
      throw new Error(
        'fetch is not available. Please use Node.js 18+ or install node-fetch'
      );
    }
  }

  private async getFormData(): Promise<new () => FormData> {
    // Try to use global FormData if available
    if (typeof FormData !== 'undefined') {
      return FormData;
    }

    // Fallback to form-data for older Node versions
    try {
      // form-data is an optional peer dependency, use dynamic import with type assertion
      const FormDataModule = await import('form-data' as string) as { default: new () => FormData };
      // form-data package has different API than browser FormData, but compatible enough
      return FormDataModule.default;
    } catch {
      throw new Error(
        'FormData is not available. Please use Node.js 18+ or install form-data'
      );
    }
  }
}


/**
 * Common typing helpers used by resource modules to avoid circular imports.
 */

export interface RequesterProtocol {
  request<T = unknown>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | number>;
      jsonData?: unknown;
      data?: Record<string, string>;
      files?: Record<string, { filename: string; content: Buffer | NodeJS.ReadableStream; contentType: string }>;
      unwrap?: boolean;
    }
  ): Promise<T>;
}


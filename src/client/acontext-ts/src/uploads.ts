/**
 * Utilities for working with file uploads.
 */

export class FileUpload {
  filename: string;
  content: Buffer | NodeJS.ReadableStream;
  contentType?: string | null;

  constructor(options: {
    filename: string;
    content: Buffer | NodeJS.ReadableStream;
    contentType?: string | null;
  }) {
    this.filename = options.filename;
    this.content = options.content;
    this.contentType = options.contentType ?? null;
  }

  /**
   * Convert to a format suitable for form-data.
   */
  asFormData(): {
    filename: string;
    content: Buffer | NodeJS.ReadableStream;
    contentType: string;
  } {
    return {
      filename: this.filename,
      content: this.content,
      contentType: this.contentType || 'application/octet-stream',
    };
  }
}

export function normalizeFileUpload(
  upload:
    | FileUpload
    | [string, Buffer | NodeJS.ReadableStream]
    | [string, Buffer | NodeJS.ReadableStream, string | null]
): FileUpload {
  if (upload instanceof FileUpload) {
    return upload;
  }
  if (Array.isArray(upload)) {
    if (upload.length === 2) {
      const [filename, content] = upload;
      return new FileUpload({ filename, content });
    }
    if (upload.length === 3) {
      const [filename, content, contentType] = upload;
      return new FileUpload({
        filename,
        content,
        contentType: contentType ?? null,
      });
    }
  }
  throw new TypeError('Unsupported file upload payload');
}


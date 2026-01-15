/**
 * Disk tools for agent operations.
 */

import { AcontextClient } from '../client';
import { FileUpload } from '../uploads';
import { AbstractBaseTool, BaseContext, BaseToolPool } from './base';

export interface DiskContext extends BaseContext {
  client: AcontextClient;
  diskId: string;
  getContextPrompt(): string;
}

function normalizePath(path: string | null | undefined): string {
  if (!path) {
    return '/';
  }
  let normalized = path.startsWith('/') ? path : `/${path}`;
  if (!normalized.endsWith('/')) {
    normalized += '/';
  }
  return normalized;
}

export class WriteFileTool extends AbstractBaseTool {
  readonly name = 'write_file';
  readonly description =
    "Write text content to a file in the file system. Creates the file if it doesn't exist, overwrites if it does.";
  readonly arguments = {
    file_path: {
      type: 'string',
      description:
        "Optional folder path to organize files, e.g. '/notes/' or '/documents/'. Defaults to root '/' if not specified.",
    },
    filename: {
      type: 'string',
      description: "Filename such as 'report.md' or 'demo.txt'.",
    },
    content: {
      type: 'string',
      description: 'Text content to write to the file.',
    },
  };
  readonly requiredArguments = ['filename', 'content'];

  async execute(ctx: DiskContext, llmArguments: Record<string, unknown>): Promise<string> {
    const filename = llmArguments.filename as string;
    const content = llmArguments.content as string;
    const filePath = (llmArguments.file_path as string) || null;

    if (!filename) {
      throw new Error('filename is required');
    }
    if (!content) {
      throw new Error('content is required');
    }

    const normalizedPath = normalizePath(filePath);
    const payload = new FileUpload({
      filename,
      content: Buffer.from(content, 'utf-8'),
      contentType: 'text/plain',
    });
    const artifact = await ctx.client.disks.artifacts.upsert(ctx.diskId, {
      file: payload,
      filePath: normalizedPath,
    });
    return `File '${artifact.filename}' written successfully to '${artifact.path}'`;
  }
}

export class ReadFileTool extends AbstractBaseTool {
  readonly name = 'read_file';
  readonly description = 'Read a text file from the file system and return its content.';
  readonly arguments = {
    file_path: {
      type: 'string',
      description:
        "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified.",
    },
    filename: {
      type: 'string',
      description: 'Filename to read.',
    },
    line_offset: {
      type: 'number',
      description: 'The line number to start reading from. Default to 0',
    },
    line_limit: {
      type: 'number',
      description: 'The maximum number of lines to return. Default to 100',
    },
  };
  readonly requiredArguments = ['filename'];

  async execute(ctx: DiskContext, llmArguments: Record<string, unknown>): Promise<string> {
    const filename = llmArguments.filename as string;
    const filePath = (llmArguments.file_path as string) || null;
    const lineOffset = (llmArguments.line_offset as number) || 0;
    const lineLimit = (llmArguments.line_limit as number) || 100;

    if (!filename) {
      throw new Error('filename is required');
    }

    const normalizedPath = normalizePath(filePath);
    const result = await ctx.client.disks.artifacts.get(ctx.diskId, {
      filePath: normalizedPath,
      filename,
      withContent: true,
    });

    if (!result.content) {
      throw new Error('Failed to read file: server did not return content.');
    }

    const contentStr = result.content.raw;
    const lines = contentStr.split('\n');
    const lineStart = Math.min(lineOffset, Math.max(0, lines.length - 1));
    const lineEnd = Math.min(lineStart + lineLimit, lines.length);
    const preview = lines.slice(lineStart, lineEnd).join('\n');
    return `[${normalizedPath}${filename} - showing L${lineStart}-${lineEnd} of ${lines.length} lines]\n${preview}`;
  }
}

export class ReplaceStringTool extends AbstractBaseTool {
  readonly name = 'replace_string';
  readonly description =
    'Replace an old string with a new string in a file. Reads the file, performs the replacement, and writes it back.';
  readonly arguments = {
    file_path: {
      type: 'string',
      description:
        "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified.",
    },
    filename: {
      type: 'string',
      description: 'Filename to modify.',
    },
    old_string: {
      type: 'string',
      description: 'The string to be replaced.',
    },
    new_string: {
      type: 'string',
      description: 'The string to replace the old_string with.',
    },
  };
  readonly requiredArguments = ['filename', 'old_string', 'new_string'];

  async execute(ctx: DiskContext, llmArguments: Record<string, unknown>): Promise<string> {
    const filename = llmArguments.filename as string;
    const filePath = (llmArguments.file_path as string) || null;
    const oldString = llmArguments.old_string as string;
    const newString = llmArguments.new_string as string;

    if (!filename) {
      throw new Error('filename is required');
    }
    if (oldString === null || oldString === undefined) {
      throw new Error('old_string is required');
    }
    if (newString === null || newString === undefined) {
      throw new Error('new_string is required');
    }

    const normalizedPath = normalizePath(filePath);

    // Read the file content
    const result = await ctx.client.disks.artifacts.get(ctx.diskId, {
      filePath: normalizedPath,
      filename,
      withContent: true,
    });

    if (!result.content) {
      throw new Error('Failed to read file: server did not return content.');
    }

    const contentStr = result.content.raw;

    // Perform the replacement
    if (!contentStr.includes(oldString)) {
      return `String '${oldString}' not found in file '${filename}'`;
    }

    // Count occurrences before replacement
    let replacementCount = 0;
    let searchIndex = 0;
    while (searchIndex < contentStr.length) {
      const index = contentStr.indexOf(oldString, searchIndex);
      if (index === -1) {
        break;
      }
      replacementCount++;
      searchIndex = index + oldString.length;
    }

    const updatedContent = contentStr.replace(oldString, newString);

    // Write the updated content back
    const payload = new FileUpload({
      filename,
      content: Buffer.from(updatedContent, 'utf-8'),
      contentType: 'text/plain',
    });
    await ctx.client.disks.artifacts.upsert(ctx.diskId, {
      file: payload,
      filePath: normalizedPath,
    });

    return `Found ${replacementCount} old_string in ${normalizedPath}${filename} and replaced it.`;
  }
}

export class ListTool extends AbstractBaseTool {
  readonly name = 'list_artifacts';
  readonly description = 'List all files and directories in a specified path on the disk.';
  readonly arguments = {
    file_path: {
      type: 'string',
      description: "Optional directory path to list, e.g. '/todo/' or '/notes/'. Root is '/'",
    },
  };
  readonly requiredArguments = ['file_path'];

  async execute(ctx: DiskContext, llmArguments: Record<string, unknown>): Promise<string> {
    const filePath = llmArguments.file_path as string;
    const normalizedPath = normalizePath(filePath);

    const result = await ctx.client.disks.artifacts.list(ctx.diskId, {
      path: normalizedPath,
    });

    const artifactsList = result.artifacts.map((artifact) => artifact.filename);

    const fileSect = artifactsList.length > 0 ? artifactsList.join('\n') : '[NO FILE]';
    const dirSect =
      result.directories.length > 0
        ? result.directories.map((d) => d.replace(/\/$/, '') + '/').join('\n')
        : '[NO DIR]';

    return `[Listing in ${normalizedPath}]\nDirectories:\n${dirSect}\nFiles:\n${fileSect}`;
  }
}

export class DownloadFileTool extends AbstractBaseTool {
  readonly name = 'download_file';
  readonly description =
    'Get a public URL to download a file. Returns a presigned URL that can be shared or used to access the file.';
  readonly arguments = {
    file_path: {
      type: 'string',
      description:
        "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified.",
    },
    filename: {
      type: 'string',
      description: 'Filename to get the download URL for.',
    },
    expire: {
      type: 'integer',
      description: 'URL expiration time in seconds. Defaults to 3600 (1 hour).',
    },
  };
  readonly requiredArguments = ['filename'];

  async execute(ctx: DiskContext, llmArguments: Record<string, unknown>): Promise<string> {
    const filename = llmArguments.filename as string;
    const filePath = (llmArguments.file_path as string) || null;
    const expire = (llmArguments.expire as number) || 3600;

    if (!filename) {
      throw new Error('filename is required');
    }

    const normalizedPath = normalizePath(filePath);
    const result = await ctx.client.disks.artifacts.get(ctx.diskId, {
      filePath: normalizedPath,
      filename,
      withPublicUrl: true,
      expire,
    });

    if (!result.public_url) {
      throw new Error('Failed to get public URL: server did not return a URL.');
    }

    return `Public download URL for '${normalizedPath}${filename}' (expires in ${expire}s):\n${result.public_url}`;
  }
}

export class GrepArtifactsTool extends AbstractBaseTool {
  readonly name = 'grep_artifacts';
  readonly description =
    'Search for text patterns within file contents using regex. Only searches text-based files (code, markdown, json, csv, etc.). Use this to find specific code patterns, TODO comments, function definitions, or any text content.';
  readonly arguments = {
    query: {
      type: 'string',
      description:
        "Regex pattern to search for (e.g., 'TODO.*', 'function.*calculate', 'import.*pandas')",
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return (default 100)',
    },
  };
  readonly requiredArguments = ['query'];

  async execute(ctx: DiskContext, llmArguments: Record<string, unknown>): Promise<string> {
    const query = llmArguments.query as string;
    const limit = (llmArguments.limit as number) || 100;

    if (!query) {
      throw new Error('query is required');
    }

    const results = await ctx.client.disks.artifacts.grepArtifacts(ctx.diskId, {
      query,
      limit,
    });

    if (results.length === 0) {
      return `No matches found for pattern '${query}'`;
    }

    const matches = results.map((artifact) => `${artifact.path}${artifact.filename}`);

    return `Found ${matches.length} file(s) matching '${query}':\n` + matches.join('\n');
  }
}

export class GlobArtifactsTool extends AbstractBaseTool {
  readonly name = 'glob_artifacts';
  readonly description =
    'Find files by path pattern using glob syntax. Use * for any characters, ? for single character, ** for recursive directories. Perfect for finding files by extension or location.';
  readonly arguments = {
    query: {
      type: 'string',
      description:
        "Glob pattern (e.g., '**/*.py' for all Python files, '*.txt' for text files in root, '/docs/**/*.md' for markdown in docs)",
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return (default 100)',
    },
  };
  readonly requiredArguments = ['query'];

  async execute(ctx: DiskContext, llmArguments: Record<string, unknown>): Promise<string> {
    const query = llmArguments.query as string;
    const limit = (llmArguments.limit as number) || 100;

    if (!query) {
      throw new Error('query is required');
    }

    const results = await ctx.client.disks.artifacts.globArtifacts(ctx.diskId, {
      query,
      limit,
    });

    if (results.length === 0) {
      return `No files found matching pattern '${query}'`;
    }

    const matches = results.map((artifact) => `${artifact.path}${artifact.filename}`);

    return `Found ${matches.length} file(s) matching '${query}':\n` + matches.join('\n');
  }
}

export class DiskToolPool extends BaseToolPool {
  formatContext(client: AcontextClient, diskId: string): DiskContext {
    return {
      client,
      diskId,
      getContextPrompt(): string {
        return '';
      },
    };
  }
}

export const DISK_TOOLS = new DiskToolPool();
DISK_TOOLS.addTool(new WriteFileTool());
DISK_TOOLS.addTool(new ReadFileTool());
DISK_TOOLS.addTool(new ReplaceStringTool());
DISK_TOOLS.addTool(new ListTool());
DISK_TOOLS.addTool(new GrepArtifactsTool());
DISK_TOOLS.addTool(new GlobArtifactsTool());
DISK_TOOLS.addTool(new DownloadFileTool());


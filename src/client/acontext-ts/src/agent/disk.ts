/**
 * Disk tools for agent operations.
 */

import { AcontextClient } from '../client';
import { FileUpload } from '../uploads';
import { AbstractBaseTool, BaseContext, BaseToolPool } from './base';

export interface DiskContext extends BaseContext {
  client: AcontextClient;
  diskId: string;
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

    if (artifactsList.length === 0 && result.directories.length === 0) {
      return `No files or directories found in '${normalizedPath}'`;
    }

    const outputParts: string[] = [];
    if (artifactsList.length > 0) {
      outputParts.push(`Files: ${artifactsList.join(', ')}`);
    }
    if (result.directories.length > 0) {
      outputParts.push(`Directories: ${result.directories.join(', ')}`);
    }

    const lsSect = outputParts.join('\n');
    return `[Listing in ${normalizedPath}]\n${lsSect}`;
  }
}

export class DiskToolPool extends BaseToolPool {
  formatContext(client: AcontextClient, diskId: string): DiskContext {
    return {
      client,
      diskId,
    };
  }
}

export const DISK_TOOLS = new DiskToolPool();
DISK_TOOLS.addTool(new WriteFileTool());
DISK_TOOLS.addTool(new ReadFileTool());
DISK_TOOLS.addTool(new ReplaceStringTool());
DISK_TOOLS.addTool(new ListTool());


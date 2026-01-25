/**
 * Agent tools for sandbox operations using the Acontext Sandbox API.
 */

import { AcontextClient } from '../client';
import { AbstractBaseTool, BaseContext, BaseToolPool } from './base';
import { SANDBOX_TEXT_EDITOR_REMINDER, SANDBOX_BASH_REMINDER } from './prompts';
import { viewFile, createFile, strReplace } from './text-editor';

export interface SandboxContext extends BaseContext {
  client: AcontextClient;
  sandboxId: string;
  diskId: string;
  mountedSkillIds: string[];
  mountedSkillPaths: Map<string, string>;
  getContextPrompt(): string;
  mountSkills(skillIds: string[]): Promise<void>;
}

function getSandboxContextPrompt(): string {
  return `<sandbox>
By default, you are in \`/workspace\`.
<text_editor_sandbox>
${SANDBOX_TEXT_EDITOR_REMINDER}
</text_editor_sandbox>
<bash_execution_sandbox>        
${SANDBOX_BASH_REMINDER}
</bash_execution_sandbox>
</sandbox>
`;
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

export class BashTool extends AbstractBaseTool {
  private _timeout?: number;

  constructor(timeout?: number) {
    super();
    this._timeout = timeout;
  }

  readonly name = 'bash_execution_sandbox';
  readonly description =
    'The bash_execution_sandbox tool enables execution of bash scripts in a secure sandboxed container environment.';
  readonly arguments = {
    command: {
      type: 'string',
      description:
        "The bash command to execute. Examples: 'ls -la', 'python3 script.py', 'sed -i 's/old_string/new_string/g' file.py'",
    },
    timeout: {
      type: ['number', 'null'],
      description:
        'Optional timeout in seconds for this command. Use for long-running commands that may exceed the default timeout.',
    },
  };
  readonly requiredArguments = ['command'];

  async execute(ctx: SandboxContext, llmArguments: Record<string, unknown>): Promise<string> {
    const command = llmArguments.command as string;
    const timeout = (llmArguments.timeout as number) ?? this._timeout;

    if (!command) {
      throw new Error('command is required');
    }

    const result = await ctx.client.sandboxes.execCommand({
      sandboxId: ctx.sandboxId,
      command,
      timeout,
    });

    return JSON.stringify({
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code,
    });
  }
}

export class TextEditorTool extends AbstractBaseTool {
  private _timeout?: number;

  constructor(timeout?: number) {
    super();
    this._timeout = timeout;
  }

  readonly name = 'text_editor_sandbox';
  readonly description = 'A tool for viewing, creating, and editing text files in the sandbox.';
  readonly arguments = {
    command: {
      type: 'string',
      enum: ['view', 'create', 'str_replace'],
      description: "The operation to perform: 'view', 'create', or 'str_replace'",
    },
    path: {
      type: 'string',
      description: "The file path in the sandbox (e.g., '/workspace/script.py')",
    },
    file_text: {
      type: ['string', 'null'],
      description: "For 'create' command: the content to write to the file",
    },
    old_str: {
      type: ['string', 'null'],
      description: "For 'str_replace' command: the exact string to find and replace",
    },
    new_str: {
      type: ['string', 'null'],
      description: "For 'str_replace' command: the string to replace old_str with",
    },
    view_range: {
      type: ['array', 'null'],
      description: "For 'view' command: optional [start_line, end_line] to view specific lines",
    },
  };
  readonly requiredArguments = ['command', 'path'];

  async execute(ctx: SandboxContext, llmArguments: Record<string, unknown>): Promise<string> {
    const command = llmArguments.command as string;
    const path = llmArguments.path as string;

    if (!command) {
      throw new Error('command is required');
    }
    if (!path) {
      throw new Error('path is required');
    }

    if (command === 'view') {
      const viewRange = llmArguments.view_range as number[] | null;
      const result = await viewFile(ctx, path, viewRange, this._timeout);
      return JSON.stringify(result);
    } else if (command === 'create') {
      const fileText = llmArguments.file_text as string;
      if (fileText === null || fileText === undefined) {
        throw new Error('file_text is required for create command');
      }
      const result = await createFile(ctx, path, fileText, this._timeout);
      return JSON.stringify(result);
    } else if (command === 'str_replace') {
      const oldStr = llmArguments.old_str as string;
      const newStr = llmArguments.new_str as string;
      if (oldStr === null || oldStr === undefined) {
        throw new Error('old_str is required for str_replace command');
      }
      if (newStr === null || newStr === undefined) {
        throw new Error('new_str is required for str_replace command');
      }
      const result = await strReplace(ctx, path, oldStr, newStr, this._timeout);
      return JSON.stringify(result);
    } else {
      throw new Error(`Unknown command: ${command}. Must be 'view', 'create', or 'str_replace'`);
    }
  }
}

export class ExportSandboxFileTool extends AbstractBaseTool {
  readonly name = 'export_sandbox_file';
  readonly description = `Export a file from the sandbox to persistent, shared disk storage, and return you a public download URL.
If the sandbox file is changed, the disk file won't be updated unless you export the file again.`;
  readonly arguments = {
    sandbox_path: {
      type: 'string',
      description:
        "The directory path in the sandbox where the file is located. Must end with '/'. Examples: '/workspace/', '/home/user/output/'",
    },
    sandbox_filename: {
      type: 'string',
      description: 'The name of the file to export from the sandbox.',
    },
  };
  readonly requiredArguments = ['sandbox_path', 'sandbox_filename'];

  async execute(ctx: SandboxContext, llmArguments: Record<string, unknown>): Promise<string> {
    const sandboxPath = llmArguments.sandbox_path as string;
    const sandboxFilename = llmArguments.sandbox_filename as string;
    const diskPath = '/artifacts/';

    if (!sandboxPath) {
      throw new Error('sandbox_path is required');
    }
    if (!sandboxFilename) {
      throw new Error('sandbox_filename is required');
    }

    const normalizedSandboxPath = normalizePath(sandboxPath);
    const normalizedDiskPath = normalizePath(diskPath);

    const artifact = await ctx.client.disks.artifacts.uploadFromSandbox(ctx.diskId, {
      sandboxId: ctx.sandboxId,
      sandboxPath: normalizedSandboxPath,
      sandboxFilename,
      filePath: normalizedDiskPath,
    });

    // Get the public URL for the uploaded artifact
    const artifactInfo = await ctx.client.disks.artifacts.get(ctx.diskId, {
      filePath: artifact.path,
      filename: artifact.filename,
      withPublicUrl: true,
      withContent: false,
    });

    return JSON.stringify({
      message: 'successfully exported file to disk',
      public_url: artifactInfo.public_url,
    });
  }
}

export class SandboxToolPool extends BaseToolPool {
  /**
   * Create a sandbox context.
   *
   * @param client - The Acontext client instance.
   * @param sandboxId - The UUID of the sandbox.
   * @param diskId - The UUID of the disk for file exports.
   * @param mountSkills - Optional list of skill IDs to download to the sandbox.
   *                     Skills are downloaded to /skills/{skill_name}/ in the sandbox.
   * @returns Promise resolving to SandboxContext for use with sandbox tools.
   */
  async formatContext(
    client: AcontextClient,
    sandboxId: string,
    diskId: string,
    mountSkills?: string[]
  ): Promise<SandboxContext> {
    const mountedSkillIds: string[] = [];
    const mountedSkillPaths = new Map<string, string>();

    const ctx: SandboxContext = {
      client,
      sandboxId,
      diskId,
      mountedSkillIds,
      mountedSkillPaths,
      getContextPrompt(): string {
        return getSandboxContextPrompt();
      },
      async mountSkills(skillIds: string[]): Promise<void> {
        for (const skillId of skillIds) {
          if (mountedSkillPaths.has(skillId)) {
            // Skip already mounted skills
            continue;
          }
          const result = await client.skills.downloadToSandbox(skillId, {
            sandboxId,
          });
          if (result.success) {
            mountedSkillIds.push(skillId);
            mountedSkillPaths.set(skillId, result.dir_path);
          }
        }
      },
    };

    if (mountSkills && mountSkills.length > 0) {
      await ctx.mountSkills(mountSkills);
    }

    return ctx;
  }
}

// Pre-configured tool pool with sandbox tools
export const SANDBOX_TOOLS = new SandboxToolPool();
SANDBOX_TOOLS.addTool(new BashTool());
SANDBOX_TOOLS.addTool(new TextEditorTool());
SANDBOX_TOOLS.addTool(new ExportSandboxFileTool());

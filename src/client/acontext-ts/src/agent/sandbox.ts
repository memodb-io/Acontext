/**
 * Agent tools for sandbox operations using the Acontext Sandbox API.
 */

import { AcontextClient } from '../client';
import { AbstractBaseTool, BaseContext, BaseToolPool } from './base';
import { viewFile, createFile, strReplace } from './text-editor';

export interface SandboxContext extends BaseContext {
  client: AcontextClient;
  sandboxId: string;
  diskId: string;
  getContextPrompt(): string;
}

const SANDBOX_CONTEXT_PROMPT = `<sandbox>
By default, you are in \`/workspace\`.
<text_editor_sandbox>
The text_editor_sandbox tool enables viewing, creating, and modifying text files within
the secure sandboxed container environment.

How it works:
- All file operations occur within the sandboxed container filesystem

Command guidelines:
- Always use view before editing to understand file structure
- For str_replace commands, ensure search strings are unique and exact
- Include sufficient context in str_replace for accurate placement
- Use proper escaping for special characters in search/replace strings
</text_editor_sandbox>
<bash_execution_sandbox>        
When to use the bash_execution_sandbox tool directly:
- File system operations requiring shell commands (moving, copying, renaming, organizing files)
- Text processing and manipulation using standard Unix tools (grep, sed, awk, cut, sort, etc.) that
should not be done by the text editor tool
- Batch processing of multiple files using shell loops and wildcards
- System inspection tasks (checking file sizes, permissions, directory structures)
- Combining multiple command-line tools in pipelines for complex data processing
- Archive operations (tar, unzip) and file compression/decompression
- Converting between file formats using command-line utilities

When you should write Python file and use bash tool to run it:
- Complex data analysis or numerical computation (use file operations to write a Python script instead, and
then the bash to run the script)
- Tasks requiring advanced programming logic or data structures

When NOT to use the bash_execution_sandbox tool:
- Simple questions that can be answered without executing commands
- Tasks that only require explaining shell concepts without actual execution

How it works:
- Scripts are saved to a temporary sandbox and executed with bash
- Tool results will include stdout, stderr, and return code
- User-uploaded files are accessible in the directory specified by the INPUT_DIR environment variable. If
you know the file path and don't need to open the full INPUT_DIR, then just open the file directly

File Operations (CRITICAL - READ CAREFULLY):
- use text_editor_sandbox tool to view, create, and edit files.

Export Your Result:
- All the files you created kept in the sandbox, which user can't see or access.
- If you want to export them to user, use \`export_sandbox_file\` tool.
- If too many files to export(>= 6 files), zip those files and export the zip file.
- Result files' names should be unique and descriptive, (wrong: result.md, output.md... right: 2026_us_market_trending.png)

Script guidelines:
- Write POSIX-compliant bash scripts
- Use proper error handling and exit codes
- Quote variables appropriately to handle spaces in filenames
- Keep scripts clean and well-organized
- Only use single-line Bash command (Never use any heredoc syntax!)
    - wrong: cat > random_plot.py << 'EOF'\\ncontent\\nEOF
    - right: \`echo "content" > random_plot.py && head random_plot.py\`

Never write blocking script:
- python codes like \`plt.show()\` or \`input()\`... will block the execution of the script, don't use them. write non-blocking code instead.

Container environment:
- NO internet access available
- Filesystem persists across multiple executions within the same container
- Standard Unix utilities available (grep, sed, awk, etc.)
- Archive tools: tar, unzip, zip
- Additional tools: ripgrep, fd, sqlite3, jq, imagemagick
- Do not try to install new packages and libraries with pip as there is no internet access
</bash_execution_sandbox>
</sandbox>
`;

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
  formatContext(client: AcontextClient, sandboxId: string, diskId: string): SandboxContext {
    return {
      client,
      sandboxId,
      diskId,
      getContextPrompt(): string {
        return SANDBOX_CONTEXT_PROMPT;
      },
    };
  }
}

// Pre-configured tool pool with sandbox tools
export const SANDBOX_TOOLS = new SandboxToolPool();
SANDBOX_TOOLS.addTool(new BashTool());
SANDBOX_TOOLS.addTool(new TextEditorTool());
SANDBOX_TOOLS.addTool(new ExportSandboxFileTool());

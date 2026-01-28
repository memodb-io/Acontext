/**
 * Text editor file operations for sandbox environments.
 */

import path from 'path';
import type { SandboxContext } from './sandbox';

const MAX_CONTENT_CHARS = 20000;

/**
 * Truncate text to maxChars, appending a truncation flag if needed.
 */
function truncateContent(text: string, maxChars: number = MAX_CONTENT_CHARS): string {
  if (text.length > maxChars) {
    return text.slice(0, maxChars) + '...[truncated]';
  }
  return text;
}

/**
 * Escape a string for safe use in shell commands.
 */
export function escapeForShell(s: string): string {
  // Use single quotes and escape any single quotes in the string
  return "'" + s.replace(/'/g, "'\"'\"'") + "'";
}

export interface ViewFileResult {
  file_type?: string;
  content?: string;
  numLines?: number;
  startLine?: number;
  totalLines?: number;
  error?: string;
  stderr?: string;
}

export interface CreateFileResult {
  is_file_update?: boolean;
  message?: string;
  error?: string;
  stderr?: string;
}

export interface StrReplaceResult {
  msg?: string;
  error?: string;
  stderr?: string;
}

/**
 * View file content with line numbers.
 */
export async function viewFile(
  ctx: SandboxContext,
  filePath: string,
  viewRange: number[] | null,
  timeout?: number
): Promise<ViewFileResult> {
  const escapedPath = escapeForShell(filePath);

  // Build combined command: check existence, get total lines, and view content in one exec
  let viewCmd: string;
  let startLine: number;

  if (viewRange && viewRange.length === 2) {
    const [rangeStart, rangeEnd] = viewRange;
    viewCmd = `sed -n '${rangeStart},${rangeEnd}p' ${escapedPath} | nl -ba -v ${rangeStart}`;
    startLine = rangeStart;
  } else {
    const maxLines = 200;
    viewCmd = `head -n ${maxLines} ${escapedPath} | nl -ba`;
    startLine = 1;
  }

  // Single combined command: outputs "TOTAL:<n>" on first line, then file content
  const cmd = `if [ ! -f ${escapedPath} ]; then echo 'FILE_NOT_FOUND'; exit 1; fi; echo "TOTAL:$(wc -l < ${escapedPath})"; ${viewCmd}`;

  const result = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: cmd,
    timeout,
  });

  if (result.exit_code !== 0 || result.stdout.includes('FILE_NOT_FOUND')) {
    return {
      error: `File not found: ${filePath}`,
      stderr: result.stderr,
    };
  }

  // Parse output: first line is "TOTAL:<n>", rest is content
  const lines = result.stdout.split('\n');
  let totalLines = 0;
  let content = '';

  if (lines.length > 0 && lines[0].startsWith('TOTAL:')) {
    const totalStr = lines[0].substring(6).trim();
    totalLines = /^\d+$/.test(totalStr) ? parseInt(totalStr, 10) : 0;
    content = lines.slice(1).join('\n');
  }

  const contentLines = content.trim() ? content.trimEnd().split('\n') : [];
  const numLines = contentLines.length;

  return {
    file_type: 'text',
    content: truncateContent(content),
    numLines,
    startLine: viewRange ? startLine : 1,
    totalLines: totalLines + 1, // wc -l doesn't count last line without newline
  };
}

/**
 * Create a new file with content.
 */
export async function createFile(
  ctx: SandboxContext,
  filePath: string,
  fileText: string,
  timeout?: number
): Promise<CreateFileResult> {
  const escapedPath = escapeForShell(filePath);
  const encodedContent = Buffer.from(fileText, 'utf-8').toString('base64');

  // Get directory path for mkdir
  const dirPath = path.posix.dirname(filePath);
  const mkdirPart = dirPath && dirPath !== '.' ? `mkdir -p ${escapeForShell(dirPath)} && ` : '';

  // Single combined command: check existence, create dir, write file
  const cmd = `is_update=$(test -f ${escapedPath} && echo 1 || echo 0); ${mkdirPart}echo ${escapeForShell(encodedContent)} | base64 -d > ${escapedPath} && echo "STATUS:$is_update"`;

  const result = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: cmd,
    timeout,
  });

  if (result.exit_code !== 0 || !result.stdout.includes('STATUS:')) {
    return {
      error: `Failed to create file: ${filePath}`,
      stderr: result.stderr,
    };
  }

  const isUpdate = result.stdout.includes('STATUS:1');

  return {
    is_file_update: isUpdate,
    message: `File ${isUpdate ? 'updated' : 'created'}: ${filePath}`,
  };
}

/**
 * Replace a string in a file.
 *
 * Uses a Python script on the sandbox to avoid transferring the entire file.
 * Only the base64-encoded oldStr and newStr are sent.
 */
export async function strReplace(
  ctx: SandboxContext,
  filePath: string,
  oldStr: string,
  newStr: string,
  timeout?: number
): Promise<StrReplaceResult> {
  const oldB64 = Buffer.from(oldStr, 'utf-8').toString('base64');
  const newB64 = Buffer.from(newStr, 'utf-8').toString('base64');

  // Write Python script and base64 encode it to avoid shell escaping issues
  const pyScript = `import sys, base64, os
old = base64.b64decode("${oldB64}").decode()
new = base64.b64decode("${newB64}").decode()
path = "${filePath}"
if not os.path.exists(path):
    print("FILE_NOT_FOUND")
    sys.exit(1)
with open(path, "r") as f:
    content = f.read()
count = content.count(old)
if count == 0:
    print("NOT_FOUND")
    sys.exit(0)
if count > 1:
    print(f"MULTIPLE:{count}")
    sys.exit(0)
with open(path, "w") as f:
    f.write(content.replace(old, new, 1))
print("SUCCESS")
`;
  const scriptB64 = Buffer.from(pyScript, 'utf-8').toString('base64');
  const cmd = `echo ${escapeForShell(scriptB64)} | base64 -d | python3`;

  const result = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: cmd,
    timeout,
  });

  const output = result.stdout.trim();

  if (result.exit_code !== 0 || output === 'FILE_NOT_FOUND') {
    return { error: `File not found: ${filePath}`, stderr: result.stderr };
  }

  if (output === 'NOT_FOUND') {
    return { error: `String not found in file: ${oldStr.substring(0, 50)}...` };
  }

  if (output.startsWith('MULTIPLE:')) {
    const count = output.split(':')[1];
    return {
      error: `Multiple occurrences (${count}) of the string found. Please provide more context to make the match unique.`,
    };
  }

  if (output === 'SUCCESS') {
    return { msg: 'Successfully replaced text at exactly one location.' };
  }

  return { error: `Unexpected response: ${output}`, stderr: result.stderr };
}

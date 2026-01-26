/**
 * Text editor file operations for sandbox environments.
 */

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
  oldStart?: number;
  oldLines?: number;
  newStart?: number;
  newLines?: number;
  lines?: string[];
  error?: string;
  stderr?: string;
}

/**
 * View file content with line numbers.
 */
export async function viewFile(
  ctx: SandboxContext,
  path: string,
  viewRange: number[] | null,
  timeout?: number
): Promise<ViewFileResult> {
  // First check if file exists and get total lines
  const checkCmd = `wc -l < ${escapeForShell(path)} 2>/dev/null || echo 'FILE_NOT_FOUND'`;
  const checkResult = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: checkCmd,
    timeout,
  });

  if (checkResult.stdout.includes('FILE_NOT_FOUND') || checkResult.exit_code !== 0) {
    return {
      error: `File not found: ${path}`,
      stderr: checkResult.stderr,
    };
  }

  const totalLines = /^\d+$/.test(checkResult.stdout.trim())
    ? parseInt(checkResult.stdout.trim(), 10)
    : 0;

  // Build the view command with line numbers
  let cmd: string;
  let startLine: number;

  if (viewRange && viewRange.length === 2) {
    const [rangeStart, rangeEnd] = viewRange;
    cmd = `sed -n '${rangeStart},${rangeEnd}p' ${escapeForShell(path)} | nl -ba -v ${rangeStart}`;
    startLine = rangeStart;
  } else {
    // Default to first 200 lines if no range specified
    const maxLines = 200;
    cmd = `head -n ${maxLines} ${escapeForShell(path)} | nl -ba`;
    startLine = 1;
  }

  const result = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: cmd,
    timeout,
  });

  if (result.exit_code !== 0) {
    return {
      error: `Failed to view file: ${path}`,
      stderr: result.stderr,
    };
  }

  // Count lines in output
  const contentLines = result.stdout.trim()
    ? result.stdout.trimEnd().split('\n')
    : [];
  const numLines = contentLines.length;

  return {
    file_type: 'text',
    content: truncateContent(result.stdout),
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
  path: string,
  fileText: string,
  timeout?: number
): Promise<CreateFileResult> {
  // Check if file already exists
  const checkCmd = `test -f ${escapeForShell(path)} && echo 'EXISTS' || echo 'NEW'`;
  const checkResult = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: checkCmd,
    timeout,
  });
  const isUpdate = checkResult.stdout.includes('EXISTS');

  // Create directory if needed
  const parts = path.split('/');
  parts.pop();
  const dirPath = parts.join('/');
  if (dirPath) {
    const mkdirCmd = `mkdir -p ${escapeForShell(dirPath)}`;
    await ctx.client.sandboxes.execCommand({
      sandboxId: ctx.sandboxId,
      command: mkdirCmd,
      timeout,
    });
  }

  // Write file using base64 encoding to safely transfer content
  const encodedContent = Buffer.from(fileText, 'utf-8').toString('base64');
  const writeCmd = `echo ${escapeForShell(encodedContent)} | base64 -d > ${escapeForShell(path)}`;

  const result = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: writeCmd,
    timeout,
  });

  if (result.exit_code !== 0) {
    return {
      error: `Failed to create file: ${path}`,
      stderr: result.stderr,
    };
  }

  return {
    is_file_update: isUpdate,
    message: `File ${isUpdate ? 'updated' : 'created'}: ${path}`,
  };
}

/**
 * Replace a string in a file.
 */
export async function strReplace(
  ctx: SandboxContext,
  path: string,
  oldStr: string,
  newStr: string,
  timeout?: number
): Promise<StrReplaceResult> {
  // First read the file content
  const readCmd = `cat ${escapeForShell(path)}`;
  const result = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: readCmd,
    timeout,
  });

  if (result.exit_code !== 0) {
    return {
      error: `File not found: ${path}`,
      stderr: result.stderr,
    };
  }

  const originalContent = result.stdout;

  // Check if oldStr exists in the file
  if (!originalContent.includes(oldStr)) {
    return {
      error: `String not found in file: ${oldStr.substring(0, 50)}...`,
    };
  }

  // Count occurrences
  let occurrences = 0;
  let searchIndex = 0;
  while (searchIndex < originalContent.length) {
    const foundIndex = originalContent.indexOf(oldStr, searchIndex);
    if (foundIndex === -1) break;
    occurrences++;
    searchIndex = foundIndex + oldStr.length;
  }

  if (occurrences > 1) {
    return {
      error: `Multiple occurrences (${occurrences}) of the string found. Please provide more context to make the match unique.`,
    };
  }

  // Perform the replacement
  const newContent = originalContent.replace(oldStr, newStr);

  // Find the line numbers affected
  const oldLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  // Find where the change starts
  let oldStart = 1;
  const minLen = Math.min(oldLines.length, newLines.length);
  for (let i = 0; i < minLen; i++) {
    if (oldLines[i] !== newLines[i]) {
      oldStart = i + 1;
      break;
    }
  }

  // Write the new content
  const encodedContent = Buffer.from(newContent, 'utf-8').toString('base64');
  const writeCmd = `echo ${escapeForShell(encodedContent)} | base64 -d > ${escapeForShell(path)}`;

  const writeResult = await ctx.client.sandboxes.execCommand({
    sandboxId: ctx.sandboxId,
    command: writeCmd,
    timeout,
  });

  if (writeResult.exit_code !== 0) {
    return {
      error: `Failed to write file: ${path}`,
      stderr: writeResult.stderr,
    };
  }

  // Calculate diff info
  const oldStrLines = oldStr.split('\n').length;
  const newStrLines = newStr.split('\n').length;

  // Build diff lines
  const diffLines: string[] = [];
  for (const line of oldStr.split('\n')) {
    diffLines.push(`-${line}`);
  }
  for (const line of newStr.split('\n')) {
    diffLines.push(`+${line}`);
  }

  return {
    oldStart,
    oldLines: oldStrLines,
    newStart: oldStart,
    newLines: newStrLines,
    lines: diffLines,
  };
}

import type { MessageRole, PartType, Part, UploadedFile, ToolCall, ToolResult } from "@/types";

/**
 * Get allowed part types for a message role
 */
export function getAllowedPartTypes(role: MessageRole): PartType[] {
  if (role === "user") {
    return ["text", "image", "audio", "video", "file", "data", "tool-result"];
  } else {
    return ["text", "thinking", "tool-call"];
  }
}

/**
 * Generate a temporary ID for uploaded files, tool calls, or tool results
 */
export function generateTempId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Build message parts array from text, files, tool calls, and tool results
 */
export function buildMessageParts(
  text: string,
  uploadedFiles: UploadedFile[],
  toolCalls: ToolCall[],
  toolResults: ToolResult[]
): Part[] {
  const parts: Part[] = [];

  // Add text part if provided
  if (text.trim()) {
    parts.push({
      type: "text",
      text: text.trim(),
    });
  }

  // Add file parts
  for (const fileItem of uploadedFiles) {
    const part: Part = {
      type: fileItem.type,
      filename: fileItem.file.name,
    };

    // For file types that need asset info, we'd need to upload first
    // For now, we'll just include the filename
    parts.push(part);
  }

  // Add tool call parts (for assistant role)
  for (const toolCall of toolCalls) {
    if (toolCall.name && toolCall.call_id) {
      try {
        const argumentsObj = JSON.parse(toolCall.parameters || "{}");
        parts.push({
          type: "tool-call",
          meta: {
            name: toolCall.name,
            id: toolCall.call_id,
            arguments: argumentsObj,
          },
        });
      } catch {
        // If JSON parsing fails, skip this tool call
      }
    }
  }

  // Add tool result parts (for user role)
  for (const toolResult of toolResults) {
    if (toolResult.tool_call_id) {
      try {
        const resultObj = JSON.parse(toolResult.result || "{}");
        parts.push({
          type: "tool-result",
          meta: {
            tool_call_id: toolResult.tool_call_id,
            result: resultObj,
          },
        });
      } catch {
        // If JSON parsing fails, use the raw string
        parts.push({
          type: "tool-result",
          text: toolResult.result,
          meta: {
            tool_call_id: toolResult.tool_call_id,
          },
        });
      }
    }
  }

  return parts;
}

/**
 * Build files object from uploaded files
 */
export function buildFilesObject(uploadedFiles: UploadedFile[]): Record<string, File> {
  const files: Record<string, File> = {};
  for (const fileItem of uploadedFiles) {
    // Use the file's name as the key, or generate one if needed
    const key = fileItem.file.name;
    files[key] = fileItem.file;
  }
  return files;
}

/**
 * Check if message has any content
 */
export function hasMessageContent(
  text: string,
  uploadedFiles: UploadedFile[],
  toolCalls: ToolCall[],
  toolResults: ToolResult[]
): boolean {
  if (text.trim()) return true;
  if (uploadedFiles.length > 0) return true;
  if (toolCalls.length > 0) return true;
  if (toolResults.length > 0) return true;
  return false;
}

/**
 * Filter files by role - remove files that aren't allowed for the role
 */
export function filterFilesByRole(files: UploadedFile[], role: MessageRole): UploadedFile[] {
  const allowedTypes = getAllowedPartTypes(role);
  return files.filter((f) => allowedTypes.includes(f.type));
}

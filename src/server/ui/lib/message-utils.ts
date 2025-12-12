import { MessageRole, PartType, ToolCall, ToolResult, UploadedFile } from "@/types";
import { MessagePartIn } from "@/api/models/space";

/**
 * Get allowed part types based on message role
 */
export function getAllowedPartTypes(role: MessageRole): PartType[] {
  switch (role) {
    case "user":
      return ["text", "image", "audio", "video", "file", "tool-result", "data"];
    case "assistant":
      return ["text", "tool-call", "data"];
    default:
      return ["text"];
  }
}

/**
 * Generate a unique ID for temporary items
 */
export function generateTempId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build message parts from form inputs
 */
export function buildMessageParts(
  textContent: string,
  uploadedFiles: UploadedFile[],
  toolCalls: ToolCall[],
  toolResults: ToolResult[]
): MessagePartIn[] {
  const parts: MessagePartIn[] = [];

  // Add text part if present
  if (textContent.trim()) {
    parts.push({ type: "text", text: textContent });
  }

  // Add file parts
  uploadedFiles.forEach((fileItem) => {
    parts.push({
      type: fileItem.type,
      file_field: fileItem.id,
    });
  });

  // Add tool calls
  toolCalls.forEach((tc) => {
    try {
      JSON.parse(tc.parameters); // Validate JSON format
      parts.push({
        type: "tool-call",
        meta: {
          id: tc.call_id,        // Unified: tool call ID
          name: tc.name,          // Unified: tool name
          arguments: tc.parameters, // Unified: JSON string format
        },
      });
    } catch (e) {
      console.error("Invalid JSON in tool call parameters:", e);
    }
  });

  // Add tool results
  toolResults.forEach((tr) => {
    parts.push({
      type: "tool-result",
      text: tr.result,           // Store result in text field
      meta: {
        tool_call_id: tr.tool_call_id, // Unified: reference to tool call
      },
    });
  });

  return parts;
}

/**
 * Build files object from uploaded files
 */
export function buildFilesObject(uploadedFiles: UploadedFile[]): Record<string, File> {
  const files: Record<string, File> = {};
  uploadedFiles.forEach((fileItem) => {
    files[fileItem.id] = fileItem.file;
  });
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
  return (
    text.trim().length > 0 ||
    uploadedFiles.length > 0 ||
    toolCalls.length > 0 ||
    toolResults.length > 0
  );
}

/**
 * Filter files by allowed types for a given role
 */
export function filterFilesByRole(
  files: UploadedFile[],
  role: MessageRole
): UploadedFile[] {
  const allowedTypes = getAllowedPartTypes(role);
  return files.filter((f) => allowedTypes.includes(f.type));
}


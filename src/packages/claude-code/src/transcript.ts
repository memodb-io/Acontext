/**
 * Transcript parsing and message merging utilities.
 *
 * Pure functions extracted from hook-handler for reuse and testability.
 */

import * as readline from "node:readline/promises";
import { createReadStream } from "node:fs";

/**
 * Parse a JSON string from stdin, returning null on empty or invalid input.
 */
export function parseStdinJson(
  raw: string,
  warn?: (msg: string) => void,
): Record<string, unknown> | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    warn?.("acontext: failed to parse stdin JSON");
    return null;
  }
}

/**
 * Read messages from the Claude Code transcript JSONL file.
 * Each line is a JSON object; we extract lines with `message.role` and `message.content`.
 */
export async function readTranscriptMessages(
  transcriptPath: string,
  warn?: (msg: string) => void,
): Promise<Record<string, unknown>[]> {
  const messages: Record<string, unknown>[] = [];
  try {
    const rl = readline.createInterface({
      input: createReadStream(transcriptPath, "utf-8"),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const msg = obj.message;
        if (msg && msg.role && msg.content !== undefined) {
          // Skip messages with empty content — the API requires at least one part
          const content = msg.content;
          if (Array.isArray(content) && content.length === 0) continue;
          if (typeof content === "string" && content.length === 0) continue;

          messages.push({
            role: msg.role,
            content,
          });
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      warn?.(`acontext: failed to read transcript: ${String(err)}`);
    }
  }
  return messages;
}

/**
 * Merge consecutive transcript entries with the same role into single messages.
 * Claude Code writes one JSONL line per content block, so an assistant turn with
 * [thinking, text, tool_use, tool_use] appears as 4 separate entries that should
 * be one message. Returns merged messages and how many raw entries each covers.
 */
export function mergeConsecutiveMessages(raw: Record<string, unknown>[]): {
  messages: Record<string, unknown>[];
  rawCounts: number[];
} {
  const messages: Record<string, unknown>[] = [];
  const rawCounts: number[] = [];

  for (const entry of raw) {
    const content = entry.content;
    const blocks = Array.isArray(content)
      ? content
      : [{ type: "text", text: content }];

    const prev =
      messages.length > 0 ? messages[messages.length - 1] : null;
    if (prev && prev.role === entry.role) {
      // Merge into previous message's content array
      (prev.content as unknown[]).push(...blocks);
      rawCounts[rawCounts.length - 1]++;
    } else {
      messages.push({ role: entry.role, content: [...blocks] });
      rawCounts.push(1);
    }
  }

  return { messages, rawCounts };
}

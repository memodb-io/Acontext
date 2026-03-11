/**
 * Hook handler for the Acontext Claude Code plugin.
 *
 * Unified entry point dispatched by CLI argument:
 *   node hook-handler.cjs session-start
 *   node hook-handler.cjs post-tool-use
 *   node hook-handler.cjs stop
 *
 * Claude Code hooks pass context via stdin as JSON, including
 * a `transcript_path` pointing to the full conversation JSONL file.
 * Messages are in Anthropic format (role + content blocks).
 */

import * as fs from "node:fs/promises";
import * as readline from "node:readline/promises";
import { createReadStream } from "node:fs";
import { AcontextBridge } from "./bridge";
import { loadConfig, resolveDataDir } from "./config";

const logger = {
  info: (msg: string) => console.error(`[info] ${msg}`),
  warn: (msg: string) => console.error(`[warn] ${msg}`),
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function parseStdinJson(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    logger.warn(`acontext: failed to parse stdin JSON`);
    return null;
  }
}

/**
 * Read messages from the Claude Code transcript JSONL file.
 * Each line is a JSON object; we extract lines with `message.role` and `message.content`.
 */
async function readTranscriptMessages(
  transcriptPath: string,
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
      logger.warn(`acontext: failed to read transcript: ${String(err)}`);
    }
  }
  return messages;
}

async function handleSessionStart(bridge: AcontextBridge): Promise<void> {
  // New session: clear old state and create fresh
  await bridge.clearSessionState();
  const sessionId = await bridge.ensureSession();
  await bridge.saveSessionState();
  logger.info(`acontext: session started: ${sessionId}`);
}

async function handlePostToolUse(
  bridge: AcontextBridge,
  config: { autoLearn: boolean; minTurnsForLearn: number },
): Promise<void> {
  // Read stdin to get hook context (includes transcript_path)
  const raw = await readStdin();
  const data = parseStdinJson(raw);

  // Restore session state from previous hook invocation
  let sessionId = bridge.getSessionId();
  if (!sessionId) {
    const restored = await bridge.loadSessionState();
    if (!restored) {
      await bridge.ensureSession();
      await bridge.saveSessionState();
    }
    sessionId = bridge.getSessionId();
  }
  if (!sessionId) return;

  // Read messages from transcript file
  const transcriptPath = data?.transcript_path as string | undefined;
  if (!transcriptPath) {
    logger.warn("acontext: no transcript_path in hook data, skipping capture");
    return;
  }

  const allMessages = await readTranscriptMessages(transcriptPath);
  if (allMessages.length === 0) return;

  // Skip already-processed messages for O(1) instead of O(n) dedup
  const lastIdx = bridge.getLastProcessedIndex();
  const newMessages = allMessages.slice(lastIdx);
  if (newMessages.length === 0) return;

  const { stored, processed } = await bridge.storeMessages(
    sessionId,
    newMessages,
    lastIdx,
  );
  if (stored > 0 || processed > 0) {
    bridge.setLastProcessedIndex(lastIdx + processed);
  }
  if (stored > 0) {
    bridge.incrementTurnCount();
    await bridge.saveSessionState();
    logger.info(
      `acontext: captured ${stored} new messages, ${allMessages.length} total in transcript (turn ${bridge.getTurnCount()})`,
    );
  }

  // Auto-learn check
  if (config.autoLearn && bridge.getTurnCount() >= config.minTurnsForLearn) {
    try {
      await bridge.flush(sessionId);
      const result = await bridge.learnFromSession(sessionId);
      if (result.status === "learned") {
        logger.info(`acontext: auto-learn triggered (learning: ${result.id})`);
      }
    } catch (err) {
      logger.warn(`acontext: auto-learn failed: ${String(err)}`);
    }
  }
}

async function handleStop(
  bridge: AcontextBridge,
  config: { autoLearn: boolean },
): Promise<void> {
  const raw = await readStdin();
  const data = parseStdinJson(raw);

  // Restore session state from previous hook invocation
  if (!bridge.getSessionId()) {
    await bridge.loadSessionState();
  }
  const sessionId = bridge.getSessionId();
  if (!sessionId) return;

  // Final capture from transcript before flushing
  const transcriptPath = data?.transcript_path as string | undefined;
  if (transcriptPath) {
    const allMessages = await readTranscriptMessages(transcriptPath);
    if (allMessages.length > 0) {
      const lastIdx = bridge.getLastProcessedIndex();
      const newMessages = allMessages.slice(lastIdx);
      if (newMessages.length > 0) {
        const { stored, processed } = await bridge.storeMessages(
          sessionId,
          newMessages,
          lastIdx,
        );
        if (stored > 0 || processed > 0) {
          bridge.setLastProcessedIndex(lastIdx + processed);
        }
        if (stored > 0) {
          logger.info(`acontext: final capture: ${stored} new messages`);
        }
      }
    }
  }

  try {
    await bridge.flush(sessionId);
    logger.info(`acontext: session flushed: ${sessionId}`);
  } catch (err) {
    logger.warn(`acontext: flush failed: ${String(err)}`);
  }

  // Intentionally skip minTurnsForLearn check here — Stop should always
  // attempt to learn at session end regardless of turn count, since this
  // is the last chance to capture knowledge from the conversation.
  if (config.autoLearn) {
    try {
      const result = await bridge.learnFromSession(sessionId);
      if (result.status === "learned") {
        logger.info(
          `acontext: end-of-session learn triggered (learning: ${result.id})`,
        );
      }
    } catch (err) {
      logger.warn(`acontext: end-of-session learn failed: ${String(err)}`);
    }
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command) {
    console.error("Usage: hook-handler.cjs <session-start|post-tool-use|stop>");
    process.exit(1);
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    // Graceful exit when API key or config is missing — don't crash the hook
    logger.info(`acontext: config unavailable (${String(err)}), skipping hook`);
    return;
  }
  if (!config.autoCapture) {
    logger.info("acontext: auto-capture disabled, skipping hook");
    return;
  }

  const dataDir = resolveDataDir();
  const bridge = new AcontextBridge(config, dataDir, logger);

  switch (command) {
    case "session-start":
      await handleSessionStart(bridge);
      break;
    case "post-tool-use":
      await handlePostToolUse(bridge, config);
      break;
    case "stop":
      await handleStop(bridge, config);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[acontext] Hook error: ${err}`);
  process.exit(1);
});

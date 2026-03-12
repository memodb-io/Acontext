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

import * as path from "node:path";
import { AcontextBridge } from "./bridge";
import { loadConfig, resolveDataDir } from "./config";
import { acquireLock, releaseLock } from "./lock";
import {
  parseStdinJson,
  readTranscriptMessages,
  mergeConsecutiveMessages,
} from "./transcript";

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

async function handleSessionStart(bridge: AcontextBridge): Promise<void> {
  // New session: clear old state and create fresh
  await bridge.clearSessionState();
  const sessionId = await bridge.ensureSession();
  await bridge.saveSessionState();
  logger.info(`acontext: session started: ${sessionId}`);

  // Fire-and-forget: sync skills to local directory for native Claude Code loading
  bridge.syncSkillsToLocal().catch((err) => {
    logger.warn(`acontext: skill sync on session-start failed: ${String(err)}`);
  });
}

async function handlePostToolUse(
  bridge: AcontextBridge,
  config: { autoLearn: boolean; minTurnsForLearn: number },
  lockDir: string,
): Promise<void> {
  // Read stdin before acquiring lock (stdin must be consumed promptly)
  const raw = await readStdin();
  const data = parseStdinJson(raw, logger.warn);

  // Acquire lock — if another hook process holds it, skip this invocation.
  // The next hook or the stop handler will pick up any missed messages.
  const locked = await acquireLock(lockDir);
  if (!locked) {
    logger.info("acontext: another hook process is active, skipping capture");
    return;
  }

  try {
    // Restore session state UNDER LOCK to see the latest lastProcessedIndex
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

    const transcriptPath = data?.transcript_path as string | undefined;
    if (!transcriptPath) {
      logger.warn(
        "acontext: no transcript_path in hook data, skipping capture",
      );
      return;
    }

    const allRawMessages = await readTranscriptMessages(transcriptPath, logger.warn);
    if (allRawMessages.length === 0) return;

    const lastIdx = bridge.getLastProcessedIndex();
    const newRaw = allRawMessages.slice(lastIdx);
    if (newRaw.length === 0) return;

    // Merge consecutive same-role entries into single messages so that e.g.
    // [thinking, text, tool_use, tool_use] from one assistant turn becomes one message.
    const { messages: merged, rawCounts } = mergeConsecutiveMessages(newRaw);

    const { stored, processed } = await bridge.storeMessages(
      sessionId,
      merged,
      lastIdx,
    );
    if (processed > 0) {
      const rawProcessed = rawCounts
        .slice(0, processed)
        .reduce((a, b) => a + b, 0);
      bridge.setLastProcessedIndex(lastIdx + rawProcessed);
    }
    if (stored > 0) {
      bridge.incrementTurnCount();
      logger.info(
        `acontext: captured ${stored} new messages (${newRaw.length} raw blocks merged to ${merged.length}), ${allRawMessages.length} total in transcript (turn ${bridge.getTurnCount()})`,
      );
    }
    if (processed > 0) {
      await bridge.saveSessionState();
    }

    // Auto-learn check
    if (
      config.autoLearn &&
      bridge.getTurnCount() >= config.minTurnsForLearn
    ) {
      try {
        await bridge.flush(sessionId);
        const result = await bridge.learnFromSession(sessionId);
        if (result.status === "learned") {
          logger.info(
            `acontext: auto-learn triggered (learning: ${result.id})`,
          );
          bridge.resetTurnCount();
          await bridge.saveSessionState();
        }
      } catch (err) {
        logger.warn(`acontext: auto-learn failed: ${String(err)}`);
      }
    }
  } finally {
    await releaseLock(lockDir);
  }
}

async function handleStop(
  bridge: AcontextBridge,
  config: { autoLearn: boolean },
  lockDir: string,
): Promise<void> {
  const raw = await readStdin();
  const data = parseStdinJson(raw, logger.warn);

  // Restore session state from previous hook invocation
  if (!bridge.getSessionId()) {
    await bridge.loadSessionState();
  }
  const sessionId = bridge.getSessionId();
  if (!sessionId) return;

  // Stop is the last chance to capture — must wait for lock (retry up to 5s)
  let locked = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    locked = await acquireLock(lockDir);
    if (locked) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  try {
    if (locked) {
      // Re-load state under lock to get latest lastProcessedIndex
      await bridge.loadSessionState();
    }

    // Final capture from transcript before flushing
    const transcriptPath = data?.transcript_path as string | undefined;
    if (transcriptPath) {
      const allRawMessages = await readTranscriptMessages(transcriptPath, logger.warn);
      if (allRawMessages.length > 0) {
        const lastIdx = bridge.getLastProcessedIndex();
        const newRaw = allRawMessages.slice(lastIdx);
        if (newRaw.length > 0) {
          const { messages: merged, rawCounts } =
            mergeConsecutiveMessages(newRaw);
          const { stored, processed } = await bridge.storeMessages(
            sessionId,
            merged,
            lastIdx,
          );
          if (processed > 0) {
            const rawProcessed = rawCounts
              .slice(0, processed)
              .reduce((a, b) => a + b, 0);
            bridge.setLastProcessedIndex(lastIdx + rawProcessed);
          }
          if (stored > 0) {
            logger.info(`acontext: final capture: ${stored} new messages`);
          }
          if (processed > 0) {
            await bridge.saveSessionState();
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
          // Sync newly learned skills to local directory
          bridge.syncSkillsToLocal().catch((err) => {
            logger.warn(
              `acontext: skill sync after learning failed: ${String(err)}`,
            );
          });
        }
      } catch (err) {
        logger.warn(`acontext: end-of-session learn failed: ${String(err)}`);
      }
    }
  } finally {
    if (locked) {
      await releaseLock(lockDir);
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
  const lockDir = path.join(dataDir, ".hook-lock");

  switch (command) {
    case "session-start":
      await handleSessionStart(bridge);
      break;
    case "post-tool-use":
      await handlePostToolUse(bridge, config, lockDir);
      break;
    case "stop":
      await handleStop(bridge, config, lockDir);
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

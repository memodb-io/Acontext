/**
 * Configuration for the Acontext Claude Code plugin.
 * All values are read from environment variables.
 */

import * as os from "node:os";
import * as path from "node:path";

export interface AcontextConfig {
  apiKey: string;
  baseUrl: string;
  userId: string;
  learningSpaceId?: string;
  skillsDir: string;
  autoCapture: boolean;
  autoLearn: boolean;
  minTurnsForLearn: number;
}

export function loadConfig(): AcontextConfig {
  const apiKey = process.env.ACONTEXT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ACONTEXT_API_KEY is required. Set it in your shell profile or Claude Code settings.",
    );
  }

  return {
    apiKey,
    baseUrl:
      process.env.ACONTEXT_BASE_URL?.trim() ||
      "https://api.acontext.app/api/v1",
    userId: process.env.ACONTEXT_USER_ID?.trim() || "default",
    learningSpaceId: process.env.ACONTEXT_LEARNING_SPACE_ID?.trim() || undefined,
    skillsDir:
      process.env.ACONTEXT_SKILLS_DIR?.trim() ||
      path.join(os.homedir(), ".claude", "skills"),
    autoCapture: process.env.ACONTEXT_AUTO_CAPTURE !== "false",
    autoLearn: process.env.ACONTEXT_AUTO_LEARN !== "false",
    minTurnsForLearn: (() => {
      // ACONTEXT_MIN_TURNS_FOR_LEARN takes priority; fall back to legacy ACONTEXT_MIN_TURNS
      const raw =
        process.env.ACONTEXT_MIN_TURNS_FOR_LEARN ||
        process.env.ACONTEXT_MIN_TURNS ||
        "4";
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? 4 : parsed;
    })(),
  };
}

/**
 * Resolve the data directory for runtime state persistence.
 * Uses CLAUDE_PLUGIN_ROOT/data/ if available, otherwise a temp dir.
 */
export function resolveDataDir(): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    return `${pluginRoot}/data`;
  }
  // Fallback for development/testing
  return `${process.env.HOME || "/tmp"}/.acontext-claude-code`;
}

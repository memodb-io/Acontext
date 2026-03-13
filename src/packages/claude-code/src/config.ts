/**
 * Configuration for the Acontext Claude Code plugin.
 * Values are resolved with priority: ~/.acontext/ files > environment variables > defaults.
 */

import * as fs from "node:fs";
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

interface CredentialsFile {
  default_project?: string;
  keys?: Record<string, string>;
}

interface AuthFile {
  user?: { id?: string; email?: string };
}

/**
 * Resolve the Acontext config directory.
 * Priority: ACONTEXT_CONFIG_DIR env var > ~/.acontext
 */
function getAcontextConfigDir(): string {
  return process.env.ACONTEXT_CONFIG_DIR || path.join(os.homedir(), ".acontext");
}

/**
 * Read credentials.json and return the default project's API key.
 */
function loadApiKeyFromCredentials(): string | undefined {
  try {
    const filePath = path.join(getAcontextConfigDir(), "credentials.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CredentialsFile;
    if (data.default_project && data.keys?.[data.default_project]) {
      return data.keys[data.default_project];
    }
  } catch {
    // File doesn't exist or is invalid — silently fall through
  }
  return undefined;
}

/**
 * Read auth.json and return the user's email.
 */
function loadUserIdFromAuth(): string | undefined {
  try {
    const filePath = path.join(getAcontextConfigDir(), "auth.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as AuthFile;
    if (data.user?.email) {
      return data.user.email;
    }
  } catch {
    // File doesn't exist or is invalid — silently fall through
  }
  return undefined;
}

export function loadConfig(): AcontextConfig {
  // Priority: ~/.acontext/credentials.json > env var
  const apiKey = loadApiKeyFromCredentials() || process.env.ACONTEXT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ACONTEXT_API_KEY is required. Set it in your shell profile, or run 'acontext login' to configure ~/.acontext/credentials.json.",
    );
  }

  // Priority: ~/.acontext/auth.json > env var > "default"
  const userId = loadUserIdFromAuth() || process.env.ACONTEXT_USER_ID?.trim() || "default";

  return {
    apiKey,
    baseUrl:
      process.env.ACONTEXT_BASE_URL?.trim() ||
      "https://api.acontext.app/api/v1",
    userId,
    learningSpaceId: process.env.ACONTEXT_LEARNING_SPACE_ID?.trim() || undefined,
    skillsDir:
      process.env.ACONTEXT_SKILLS_DIR?.trim() ||
      path.join(os.homedir(), ".claude", "skills"),
    autoCapture: process.env.ACONTEXT_AUTO_CAPTURE !== "false",
    autoLearn: process.env.ACONTEXT_AUTO_LEARN !== "false",
    minTurnsForLearn: (() => {
      const raw =
        process.env.ACONTEXT_MIN_TURNS_FOR_LEARN ||
        process.env.ACONTEXT_MIN_TURNS ||
        "4";
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) || parsed < 1 ? 4 : parsed;
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
    return path.join(pluginRoot, "data");
  }
  // Fallback for development/testing
  return path.join(os.homedir(), ".acontext-claude-code");
}

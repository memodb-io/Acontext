/**
 * OpenClaw Acontext Plugin
 *
 * Skill memory for OpenClaw agents — captures conversations, extracts tasks,
 * distills reusable skills, and syncs them to OpenClaw's native skill directory.
 *
 * Features:
 * - Auto-capture: stores each agent turn to an Acontext session
 * - Skill sync: downloads learned skills to ~/.openclaw/skills/ for native loading
 * - Auto-learn: triggers Learning Space skill distillation after sessions
 * - 3 tools: acontext_search_skills, acontext_session_history, acontext_learn_now
 * - CLI: openclaw acontext skills, openclaw acontext stats
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

// ============================================================================
// Types
// ============================================================================

export type AcontextConfig = {
  apiKey: string;
  baseUrl: string;
  userId: string;
  learningSpaceId?: string;
  skillsDir: string;
  autoCapture: boolean;
  autoLearn: boolean;
  minTurnsForLearn: number;
};

interface AcontextClientLike {
  sessions: {
    list(options?: Record<string, unknown>): Promise<{ items: Array<{ id: string; created_at?: string }>; has_more: boolean }>;
    create(options?: Record<string, unknown>): Promise<{ id: string }>;
    storeMessage(sessionId: string, blob: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ id: string }>;
    flush(sessionId: string): Promise<{ status: number; errmsg: string }>;
    getSessionSummary(sessionId: string, options?: Record<string, unknown>): Promise<string>;
  };
  learningSpaces: {
    list(options?: Record<string, unknown>): Promise<{ items: Array<{ id: string }>; has_more: boolean }>;
    create(options?: Record<string, unknown>): Promise<{ id: string }>;
    listSkills(spaceId: string): Promise<Array<{
      id: string;
      name: string;
      description: string;
      disk_id: string;
      file_index?: Array<{ path: string; mime: string }>;
      updated_at: string;
    }>>;
    learn(options: { spaceId: string; sessionId: string }): Promise<{ id: string }>;
  };
  skills: {
    getFile(options: { skillId: string; filePath: string; expire?: number }): Promise<{ content?: { type: string; raw: string } | null; url?: string | null }>;
  };
  artifacts: {
    grepArtifacts(diskId: string, options: { query: string; limit?: number }): Promise<Array<{ path: string; filename: string }>>;
  };
}

// ============================================================================
// Config Parsing (exported for testing)
// ============================================================================

export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    if (envValue === "") {
      throw new Error(`Environment variable ${envVar} is set but empty`);
    }
    return envValue;
  });
}

const ALLOWED_KEYS = [
  "apiKey",
  "baseUrl",
  "userId",
  "learningSpaceId",
  "skillsDir",
  "autoCapture",
  "autoLearn",
  "minTurnsForLearn",
];

export function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
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
    const data = JSON.parse(fsSync.readFileSync(filePath, "utf-8")) as {
      default_project?: string;
      keys?: Record<string, string>;
    };
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
    const data = JSON.parse(fsSync.readFileSync(filePath, "utf-8")) as {
      user?: { email?: string };
    };
    if (data.user?.email) {
      return data.user.email;
    }
  } catch {
    // File doesn't exist or is invalid — silently fall through
  }
  return undefined;
}

export const configSchema = {
  parse(value: unknown): AcontextConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("acontext plugin config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ALLOWED_KEYS, "acontext config");

    // Resolve apiKey: ~/.acontext/credentials.json > config/env var
    let resolvedApiKey: string | undefined;
    resolvedApiKey = loadApiKeyFromCredentials();
    if (!resolvedApiKey && typeof cfg.apiKey === "string" && cfg.apiKey) {
      try {
        resolvedApiKey = resolveEnvVars(cfg.apiKey).trim() || undefined;
      } catch {
        // Env var resolution failed — fall through
      }
    }
    if (!resolvedApiKey) {
      throw new Error(
        'ACONTEXT_API_KEY is required. Run "acontext login" to configure ~/.acontext/credentials.json, or set apiKey in plugin config.',
      );
    }

    // Resolve userId: ~/.acontext/auth.json > config > "default"
    const userId =
      loadUserIdFromAuth() ||
      (typeof cfg.userId === "string" && cfg.userId ? cfg.userId : undefined) ||
      "default";

    return {
      apiKey: resolvedApiKey,
      baseUrl:
        typeof cfg.baseUrl === "string" && cfg.baseUrl
          ? resolveEnvVars(cfg.baseUrl)
          : "https://api.acontext.app/api/v1",
      userId,
      learningSpaceId:
        typeof cfg.learningSpaceId === "string"
          ? cfg.learningSpaceId
          : undefined,
      skillsDir:
        typeof cfg.skillsDir === "string" && cfg.skillsDir
          ? cfg.skillsDir
          : path.join(os.homedir(), ".openclaw", "skills"),
      autoCapture: cfg.autoCapture !== false,
      autoLearn: cfg.autoLearn !== false,
      minTurnsForLearn:
        typeof cfg.minTurnsForLearn === "number" ? cfg.minTurnsForLearn : 4,
    };
  },
};

// ============================================================================
// Acontext Client Wrapper
// ============================================================================

export interface BridgeLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
}

export type LearnResult =
  | { status: "learned"; id: string }
  | { status: "skipped" }
  | { status: "error" };

type SkillMeta = {
  id: string;
  name: string;
  description: string;
  diskId: string;
  fileIndex: Array<{ path: string; mime: string }>;
  updatedAt: string;
};

interface SkillManifest {
  syncedAt: number;
  skills: SkillMeta[];
}

/**
 * Sanitize a skill name for use as a directory name.
 * Replaces non-alphanumeric characters (except hyphens/underscores) with hyphens.
 * Throws if the result is empty to prevent operating on the skills root directory.
 *
 * Note: different names can collide (e.g. "My Skill!" and "my--skill" both → "my-skill").
 * In practice this is rare since skill names come from the Acontext API which enforces uniqueness.
 */
export function sanitizeSkillName(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!sanitized) {
    throw new Error(`Cannot sanitize skill name to valid directory name: "${name}"`);
  }
  return sanitized;
}

/**
 * Write a file atomically: write to a .tmp sibling then rename into place.
 * Prevents corruption if the process crashes mid-write.
 */
let atomicWriteCounter = 0;
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + `.tmp.${process.pid}.${Date.now()}.${atomicWriteCounter++}`;
  await fs.writeFile(tmpPath, data, "utf-8");
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

// ============================================================================
// Message Normalization (pi-agent-core → OpenAI Chat Completions)
// ============================================================================

type ContentBlock = {
  type: string;
  text?: string;
  name?: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  content?: unknown;
  [key: string]: unknown;
};

type AgentMessage = {
  role: string;
  content?: string | ContentBlock[] | null;
  [key: string]: unknown;
};

type OpenAIMessage = {
  role: string;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

/**
 * Convert pi-agent-core AgentMessage[] to standard OpenAI Chat Completions format.
 *
 * - Extracts only { role, content } and converts non-standard roles/structures
 * - Drops thinking blocks, extra fields (api, model, usage, timestamp, etc.)
 * - Skips empty assistant messages and unknown roles
 */
export function normalizeMessages(
  messages: Record<string, unknown>[],
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  for (const msg of messages) {
    const role = msg.role as string | undefined;
    if (!role) continue;

    if (role === "user") {
      const normalized = normalizeUserMessage(msg as AgentMessage);
      if (normalized) result.push(normalized);
    } else if (role === "assistant") {
      const normalized = normalizeAssistantMessage(msg as AgentMessage);
      if (normalized) result.push(normalized);
    } else if (role === "toolResult") {
      const normalized = normalizeToolResultMessage(msg as AgentMessage);
      if (normalized) result.push(normalized);
    }
    // Unknown roles are silently skipped
  }

  return result;
}

function normalizeUserMessage(msg: AgentMessage): OpenAIMessage | null {
  const content = extractTextContent(msg.content);
  if (content === null || content === undefined) return null;
  return { role: "user", content };
}

function normalizeAssistantMessage(msg: AgentMessage): OpenAIMessage | null {
  // content undefined/null → skip
  if (msg.content === undefined || msg.content === null) return null;

  if (typeof msg.content === "string") {
    if (!msg.content) return null;
    return { role: "assistant", content: msg.content };
  }

  if (!Array.isArray(msg.content)) return null;

  // Extract text and tool_calls from content blocks
  const textParts: string[] = [];
  const toolCalls: OpenAIMessage["tool_calls"] = [];

  for (const block of msg.content as ContentBlock[]) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    } else if (block.type === "toolCall" || block.type === "tool_use") {
      toolCalls.push({
        id: (block.toolCallId ?? block.id ?? "") as string,
        type: "function",
        function: {
          name: (block.toolName ?? block.name ?? "") as string,
          arguments:
            typeof block.input === "string"
              ? block.input
              : JSON.stringify(block.input ?? {}),
        },
      });
    }
    // thinking blocks and other types are silently ignored
  }

  // Empty array with no text and no tool_calls → skip
  if (textParts.length === 0 && toolCalls.length === 0) return null;

  const normalized: OpenAIMessage = { role: "assistant" };
  normalized.content = textParts.length > 0 ? textParts.join("\n") : null;
  if (toolCalls.length > 0) normalized.tool_calls = toolCalls;
  return normalized;
}

function normalizeToolResultMessage(msg: AgentMessage): OpenAIMessage | null {
  const toolCallId = (msg as Record<string, unknown>).toolCallId as
    | string
    | undefined;
  const content = extractTextContent(msg.content);
  return {
    role: "tool",
    tool_call_id: toolCallId ?? "",
    content: content ?? "",
  };
}

function extractTextContent(
  content: string | ContentBlock[] | null | undefined,
): string | null {
  if (content === undefined || content === null) return null;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;

  const texts = (content as ContentBlock[])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!);
  return texts.length > 0 ? texts.join("\n") : null;
}

export class AcontextBridge {
  private client: AcontextClientLike | null = null;
  private initPromise: Promise<void> | null = null;
  private sessionMap = new Map<string, string>();
  private sessionPromises = new Map<string, Promise<string>>();
  private learningSpaceId: string | null = null;
  private learningSpacePromise: Promise<string> | null = null;
  private logger: BridgeLogger;
  private dataDir: string;
  private skillsDir: string;

  private skillsMetadata: SkillMeta[] | null = null;
  private skillsSynced = false;
  private syncInProgress: Promise<SkillMeta[]> | null = null;
  private learnedSessions = new Set<string>();
  private learnedSessionsLoaded = false;
  private learnedSessionsLoadPromise: Promise<void> | null = null;
  private sentMessages = new Map<string, Map<string, string>>();
  private sentMessagesLoaded = false;
  private sentMessagesLoadPromise: Promise<void> | null = null;
  private static MANIFEST_STALE_MS = 30 * 60 * 1000; // 30 minutes
  static MAX_SENT_SESSIONS = 100;
  static MAX_LEARNED_SESSIONS = 500;

  constructor(private readonly cfg: AcontextConfig, dataDir: string, skillsDir: string, logger?: BridgeLogger) {
    this.dataDir = dataDir;
    this.skillsDir = skillsDir;
    this.logger = logger ?? { info: () => {}, warn: () => {} };
    if (cfg.learningSpaceId) {
      this.learningSpaceId = cfg.learningSpaceId;
    }
  }

  private manifestPath(): string {
    return path.join(this.dataDir, ".manifest.json");
  }

  private learnedSessionsPath(): string {
    return path.join(this.dataDir, ".learned-sessions.json");
  }

  private async loadLearnedSessions(): Promise<void> {
    try {
      const raw = await fs.readFile(this.learnedSessionsPath(), "utf-8");
      const ids = JSON.parse(raw) as string[];
      for (const id of ids) this.learnedSessions.add(id);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        this.logger.warn(`acontext: failed to load learned-sessions state: ${String(err)}`);
      }
    }
  }

  private async persistLearnedSessions(): Promise<void> {
    // Evict oldest entries if over cap
    if (this.learnedSessions.size > AcontextBridge.MAX_LEARNED_SESSIONS) {
      const arr = [...this.learnedSessions];
      const toKeep = arr.slice(arr.length - AcontextBridge.MAX_LEARNED_SESSIONS);
      this.learnedSessions = new Set(toKeep);
    }
    await fs.mkdir(this.dataDir, { recursive: true });
    await atomicWriteFile(
      this.learnedSessionsPath(),
      JSON.stringify([...this.learnedSessions]),
    );
  }

  private sentMessagesPath(): string {
    return path.join(this.dataDir, ".sent-messages.json");
  }

  private async loadSentMessages(): Promise<void> {
    try {
      const raw = await fs.readFile(this.sentMessagesPath(), "utf-8");
      const data = JSON.parse(raw) as Record<string, Record<string, string>>;
      for (const [sessionId, hashes] of Object.entries(data)) {
        this.sentMessages.set(sessionId, new Map(Object.entries(hashes)));
      }
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        this.logger.warn(`acontext: failed to load sent-messages state: ${String(err)}`);
      }
    }
  }

  private async persistSentMessages(): Promise<void> {
    // Evict oldest sessions if over cap (Map preserves insertion order)
    if (this.sentMessages.size > AcontextBridge.MAX_SENT_SESSIONS) {
      const keys = [...this.sentMessages.keys()];
      const toRemove = keys.slice(0, keys.length - AcontextBridge.MAX_SENT_SESSIONS);
      for (const key of toRemove) {
        this.sentMessages.delete(key);
      }
    }
    await fs.mkdir(this.dataDir, { recursive: true });
    const data: Record<string, Record<string, string>> = {};
    for (const [sessionId, hashes] of this.sentMessages) {
      data[sessionId] = Object.fromEntries(hashes);
    }
    await atomicWriteFile(this.sentMessagesPath(), JSON.stringify(data));
  }

  static computeMessageHash(index: number, blob: Record<string, unknown>): string {
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ i: index, r: blob.role, c: blob.content }))
      .digest("hex")
      .slice(0, 16);
    return `${index}:${hash}`;
  }

  private skillDir(skillName: string): string {
    return path.join(this.skillsDir, sanitizeSkillName(skillName));
  }

  private async readManifest(): Promise<SkillManifest | null> {
    try {
      const raw = await fs.readFile(this.manifestPath(), "utf-8");
      return JSON.parse(raw) as SkillManifest;
    } catch {
      return null;
    }
  }

  private async writeManifest(skills: SkillMeta[]): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const manifest: SkillManifest = { syncedAt: Date.now(), skills };
    await atomicWriteFile(this.manifestPath(), JSON.stringify(manifest));
  }

  /**
   * Download .md files for a single skill to OpenClaw's native skill directory.
   */
  private async downloadSkillFiles(skill: SkillMeta): Promise<boolean> {
    const client = await this.ensureClient();
    const dir = this.skillDir(skill.name);
    let allSucceeded = true;

    for (const fi of skill.fileIndex) {
      if (!fi.path.endsWith(".md")) continue;

      const fileDest = path.resolve(dir, fi.path);
      const rel = path.relative(dir, fileDest);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        this.logger.warn(`acontext: skipping file with path traversal: ${fi.path} (skill: ${skill.name})`);
        continue;
      }
      await fs.mkdir(path.dirname(fileDest), { recursive: true });

      try {
        const resp = await client.skills.getFile({
          skillId: skill.id,
          filePath: fi.path,
          expire: 60,
        });
        if (resp.content) {
          if (resp.content.type === "base64") {
            await fs.writeFile(fileDest, Buffer.from(resp.content.raw, "base64"));
          } else {
            await fs.writeFile(fileDest, resp.content.raw, "utf-8");
          }
        } else if (resp.url) {
          const res = await fetch(resp.url);
          if (res.ok) {
            await fs.writeFile(fileDest, Buffer.from(await res.arrayBuffer()));
          } else {
            allSucceeded = false;
          }
        }
      } catch (err) {
        this.logger.warn(`acontext: download failed for ${skill.id}:${fi.path}: ${String(err)}`);
        allSucceeded = false;
      }
    }
    return allSucceeded;
  }

  /**
   * Sync skills from API to OpenClaw's native skill directory.
   * Uses updated_at for incremental sync — only downloads new or changed skills.
   * Concurrent calls are deduplicated via a promise guard.
   */
  async syncSkillsToLocal(): Promise<SkillMeta[]> {
    if (this.syncInProgress) return this.syncInProgress;
    this.syncInProgress = this._doSync();
    try {
      return await this.syncInProgress;
    } finally {
      this.syncInProgress = null;
    }
  }

  private async _doSync(): Promise<SkillMeta[]> {
    const client = await this.ensureClient();
    const spaceId = await this.ensureLearningSpace();
    const rawSkills = await client.learningSpaces.listSkills(spaceId);
    const remoteSkills: SkillMeta[] = rawSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      diskId: s.disk_id,
      fileIndex: s.file_index ?? [],
      updatedAt: s.updated_at,
    }));

    const manifest = await this.readManifest();
    const localMap = new Map<string, SkillMeta>();
    if (manifest) {
      for (const s of manifest.skills) {
        localMap.set(s.id, s);
      }
    }

    const remoteIds = new Set<string>();
    const failedSkillIds = new Set<string>();
    const sanitizedNames = new Map<string, string[]>(); // sanitized-name → skill-ids
    let downloadCount = 0;

    const collidingSkillIds = new Set<string>();

    // Pass 1: detect all sanitized name collisions before downloading anything
    for (const skill of remoteSkills) {
      const sName = sanitizeSkillName(skill.name);
      const existing = sanitizedNames.get(sName);
      if (existing) {
        existing.push(skill.id);
      } else {
        sanitizedNames.set(sName, [skill.id]);
      }
    }
    for (const [sName, ids] of sanitizedNames) {
      if (ids.length > 1) {
        this.logger.warn(`acontext: sanitized name collision — ${ids.length} skills collide as "${sName}", skipping all: ${ids.join(", ")}`);
        for (const id of ids) collidingSkillIds.add(id);
      }
    }

    // Pass 2: download non-colliding skills
    for (const skill of remoteSkills) {
      if (collidingSkillIds.has(skill.id)) continue;
      remoteIds.add(skill.id);

      const local = localMap.get(skill.id);

      if (!local || local.updatedAt !== skill.updatedAt) {
        if (local && sanitizeSkillName(local.name) !== sanitizeSkillName(skill.name)) {
          const oldDir = this.skillDir(local.name);
          await fs.rm(oldDir, { recursive: true, force: true }).catch(() => {});
        }
        const targetDir = this.skillDir(skill.name);
        await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
        const success = await this.downloadSkillFiles(skill);
        if (!success) {
          failedSkillIds.add(skill.id);
        }
        downloadCount++;
      }
    }

    // Clean up disk directories for colliding skills that were previously synced
    for (const cid of collidingSkillIds) {
      const local = localMap.get(cid);
      if (local) {
        const dir = this.skillDir(local.name);
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    }

    for (const [id, local] of localMap) {
      if (!remoteIds.has(id) && !collidingSkillIds.has(id)) {
        const dir = this.skillDir(local.name);
        await fs.rm(dir, { recursive: true, force: true }).catch((err) => {
          this.logger.warn(`acontext: failed to remove deleted skill dir ${dir}: ${String(err)}`);
        });
      }
    }

    // Filter out colliding skills, then preserve old updatedAt for failed downloads
    const nonCollidingSkills = remoteSkills.filter((s) => !collidingSkillIds.has(s.id));
    const manifestSkills = nonCollidingSkills.map((skill) => {
      if (failedSkillIds.has(skill.id)) {
        const local = localMap.get(skill.id);
        return { ...skill, updatedAt: local?.updatedAt ?? "" };
      }
      return skill;
    });
    await this.writeManifest(manifestSkills);
    this.skillsMetadata = nonCollidingSkills;
    this.skillsSynced = true;

    if (downloadCount > 0) {
      this.logger.info(`acontext: synced ${downloadCount} skill(s) to ${this.skillsDir} (${nonCollidingSkills.length} total)`);
    }
    return nonCollidingSkills;
  }

  private async ensureClient(): Promise<AcontextClientLike> {
    if (this.client) return this.client;
    if (!this.initPromise) {
      this.initPromise = this._init().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    await this.initPromise;
    return this.client!;
  }

  private async _init(): Promise<void> {
    const { AcontextClient } = await import("@acontext/acontext");
    this.client = new AcontextClient({
      apiKey: this.cfg.apiKey,
      baseUrl: this.cfg.baseUrl,
    }) as unknown as AcontextClientLike;
  }

  async ensureSession(openclawSessionKey: string): Promise<string> {
    const cached = this.sessionMap.get(openclawSessionKey);
    if (cached) return cached;

    const inflight = this.sessionPromises.get(openclawSessionKey);
    if (inflight) return inflight;

    const promise = this._createOrFindSession(openclawSessionKey).then(
      (result) => { this.sessionPromises.delete(openclawSessionKey); return result; },
      (err) => { this.sessionPromises.delete(openclawSessionKey); throw err; },
    );
    this.sessionPromises.set(openclawSessionKey, promise);
    return promise;
  }

  private async _createOrFindSession(openclawSessionKey: string): Promise<string> {
    const client = await this.ensureClient();

    const existing = await client.sessions.list({
      user: this.cfg.userId,
      filterByConfigs: {
        source: "openclaw",
        openclaw_session_key: openclawSessionKey,
      },
      limit: 1,
    });
    if (existing.items.length > 0) {
      const sid = existing.items[0].id;
      this.sessionMap.set(openclawSessionKey, sid);
      return sid;
    }

    const session = await client.sessions.create({
      user: this.cfg.userId,
      configs: {
        source: "openclaw",
        openclaw_session_key: openclawSessionKey,
      },
    });
    this.sessionMap.set(openclawSessionKey, session.id);
    return session.id;
  }

  clearSessionMapping(key: string): void {
    this.sessionMap.delete(key);
  }

  async ensureLearningSpace(): Promise<string> {
    if (this.learningSpaceId) return this.learningSpaceId;

    if (this.learningSpacePromise) return this.learningSpacePromise;

    this.learningSpacePromise = this._createOrFindLearningSpace().catch((err) => {
      this.learningSpacePromise = null;
      throw err;
    });
    return this.learningSpacePromise;
  }

  private async _createOrFindLearningSpace(): Promise<string> {
    const client = await this.ensureClient();

    const existing = await client.learningSpaces.list({
      user: this.cfg.userId,
      filterByMeta: { source: "openclaw" },
      limit: 1,
    });
    if (existing.items.length > 0) {
      this.learningSpaceId = existing.items[0].id;
      return this.learningSpaceId!;
    }

    const space = await client.learningSpaces.create({
      user: this.cfg.userId,
      meta: { source: "openclaw" },
    });
    this.learningSpaceId = space.id;
    return this.learningSpaceId!;
  }

  // -- Skill sync --------------------------------------------------------------

  async listSkills(): Promise<SkillMeta[]> {
    if (this.skillsMetadata && this.skillsSynced) {
      return this.skillsMetadata;
    }

    try {
      const manifest = await this.readManifest();
      if (manifest && Date.now() - manifest.syncedAt < AcontextBridge.MANIFEST_STALE_MS) {
        this.skillsMetadata = manifest.skills;
        this.skillsSynced = true;
        return manifest.skills;
      }

      return await this.syncSkillsToLocal();
    } catch (err) {
      this.logger.warn(`acontext: listSkills failed, returning cached: ${String(err)}`);
      return this.skillsMetadata ?? [];
    }
  }

  async grepSkills(diskId: string, query: string, limit = 10): Promise<Array<{ path: string; filename: string }>> {
    const client = await this.ensureClient();
    try {
      const result = await client.artifacts.grepArtifacts(diskId, {
        query,
        limit,
      });
      return (result ?? []).map((a) => ({
        path: a.path,
        filename: a.filename,
      }));
    } catch (err) {
      this.logger.warn(`acontext: grepSkills failed for disk ${diskId}: ${String(err)}`);
      return [];
    }
  }

  // -- Session history (on-demand) ---------------------------------------------

  async getRecentSessionSummaries(limit = 3): Promise<string> {
    const client = await this.ensureClient();
    try {
      const sessions = await client.sessions.list({
        user: this.cfg.userId,
        limit,
        timeDesc: true,
        filterByConfigs: { source: "openclaw" },
      });

      if (!sessions.items.length) return "";

      const parts: string[] = [];
      for (const session of sessions.items) {
        try {
          const summary = await client.sessions.getSessionSummary(
            session.id,
            { limit: 20 },
          );
          if (summary) {
            parts.push(
              `<session id="${session.id}" created="${session.created_at}">\n${summary}\n</session>`,
            );
          }
        } catch (err) {
          this.logger.warn(`acontext: getSessionSummary failed for ${session.id}: ${String(err)}`);
        }
      }
      return parts.join("\n");
    } catch (err) {
      this.logger.warn(`acontext: getRecentSessionSummaries failed: ${String(err)}`);
      return "";
    }
  }

  // -- Capture -----------------------------------------------------------------

  async storeMessage(
    sessionId: string,
    blob: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const client = await this.ensureClient();
    return await client.sessions.storeMessage(sessionId, blob, { format: "openai" });
  }

  async storeMessages(
    sessionId: string,
    blobs: Record<string, unknown>[],
    startIndex = 0,
  ): Promise<{ stored: number; processed: number }> {
    if (!this.sentMessagesLoaded) {
      if (!this.sentMessagesLoadPromise) {
        this.sentMessagesLoadPromise = this.loadSentMessages().then(() => {
          this.sentMessagesLoaded = true;
          this.sentMessagesLoadPromise = null;
        }).catch((err) => {
          this.sentMessagesLoadPromise = null;
          throw err;
        });
      }
      await this.sentMessagesLoadPromise;
    }

    const client = await this.ensureClient();
    let sessionSent = this.sentMessages.get(sessionId);
    if (!sessionSent) {
      sessionSent = new Map();
      this.sentMessages.set(sessionId, sessionSent);
    }

    let stored = 0;
    let processed = 0;
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const hash = AcontextBridge.computeMessageHash(startIndex + i, blob);

      if (sessionSent.has(hash)) {
        this.logger.info(`acontext: skipping duplicate message ${hash}`);
        processed++;
        continue;
      }

      try {
        const result = await client.sessions.storeMessage(sessionId, blob, { format: "openai" });
        sessionSent.set(hash, result.id);
        stored++;
        processed++;
      } catch (err) {
        this.logger.warn(`acontext: storeMessage failed at index ${startIndex + i}: ${String(err)}`);
        break;
      }
    }

    if (stored > 0) {
      await this.persistSentMessages();
    }
    return { stored, processed };
  }

  async flush(sessionId: string): Promise<{ status: number; errmsg: string }> {
    const client = await this.ensureClient();
    return await client.sessions.flush(sessionId);
  }

  // -- Learn -------------------------------------------------------------------

  async learnFromSession(sessionId: string): Promise<LearnResult> {
    if (!this.learnedSessionsLoaded) {
      if (!this.learnedSessionsLoadPromise) {
        this.learnedSessionsLoadPromise = this.loadLearnedSessions().then(() => {
          this.learnedSessionsLoaded = true;
          this.learnedSessionsLoadPromise = null;
        }).catch((err) => {
          this.learnedSessionsLoadPromise = null;
          throw err;
        });
      }
      await this.learnedSessionsLoadPromise;
    }

    if (this.learnedSessions.has(sessionId)) {
      return { status: "skipped" };
    }

    const client = await this.ensureClient();
    const spaceId = await this.ensureLearningSpace();
    try {
      const result = await client.learningSpaces.learn({
        spaceId,
        sessionId,
      });
      this.learnedSessions.add(sessionId);
      await this.persistLearnedSessions();
      this.invalidateSkillCaches();
      return { status: "learned", id: result.id };
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already learned")) {
        this.learnedSessions.add(sessionId);
        await this.persistLearnedSessions();
        this.invalidateSkillCaches();
        this.logger.info(`acontext: session ${sessionId} already learned, skipping`);
        return { status: "skipped" };
      }
      this.logger.warn(`acontext: learnFromSession failed for ${sessionId}: ${msg}`);
      return { status: "error" };
    }
  }

  invalidateSkillCaches(): void {
    this.skillsMetadata = null;
    this.skillsSynced = false;
  }

  // -- Stats -------------------------------------------------------------------

  async getStats(): Promise<{
    sessionCount: number;
    sessionCountIsApproximate: boolean;
    skillCount: number;
    learningSpaceId: string | null;
  }> {
    const client = await this.ensureClient();
    try {
      const sessions = await client.sessions.list({
        user: this.cfg.userId,
        filterByConfigs: { source: "openclaw" },
        limit: 100,
      });
      const skills = await this.listSkills();
      return {
        sessionCount: sessions.items.length,
        sessionCountIsApproximate: sessions.has_more,
        skillCount: skills.length,
        learningSpaceId: this.learningSpaceId,
      };
    } catch (err) {
      this.logger.warn(`acontext: getStats failed: ${String(err)}`);
      return { sessionCount: 0, sessionCountIsApproximate: false, skillCount: 0, learningSpaceId: null };
    }
  }
}

// ============================================================================
// Plugin Definition
// ============================================================================

const acontextPlugin = {
  id: "acontext",
  name: "Acontext Skill Memory",
  version: "0.1.9",
  description:
    "Acontext skill memory — auto-capture, auto-learn, sync skills to OpenClaw native directory",
  kind: "memory" as const,
  configSchema,

  register(api: OpenClawPluginApi) {
    const cfg = configSchema.parse(api.pluginConfig);
    const dataDir = api.resolvePath("data");
    const bridge = new AcontextBridge(cfg, dataDir, cfg.skillsDir, api.logger);

    let currentOpenClawSessionKey: string | undefined;
    let currentAcontextSessionId: string | undefined;
    let capturedTurnCount = 0;
    /** Number of messages already captured from the current session transcript. */
    let capturedMessageCursor = 0;
    /** Set by compaction/reset hooks so the next agent_end re-baselines the cursor. */
    let pendingCursorReset = false;

    api.logger.info(
      `acontext: registered (user: ${cfg.userId}, autoCapture: ${cfg.autoCapture}, autoLearn: ${cfg.autoLearn}, skillsDir: ${cfg.skillsDir})`,
    );

    // ========================================================================
    // Tools
    // ========================================================================

    api.registerTool(
      {
        name: "acontext_search_skills",
        label: "Search Skills",
        description:
          "Search through learned skill files by keyword. Use when you need to find specific knowledge from past sessions.",
        parameters: Type.Object({
          query: Type.String({ description: "Search keyword or regex pattern" }),
          limit: Type.Optional(
            Type.Number({ description: "Max results (default: 10)" }),
          ),
        }),
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const { query, limit = 10 } = params as {
            query: string;
            limit?: number;
          };

          try {
            const skills = await bridge.listSkills();
            if (skills.length === 0) {
              return {
                content: [
                  { type: "text", text: "No skills learned yet." },
                ],
                details: { count: 0 },
              };
            }

            const allMatches: Array<{
              skillName: string;
              path: string;
              filename: string;
            }> = [];

            for (const skill of skills) {
              if (!skill.diskId) continue;
              const remaining = limit - allMatches.length;
              if (remaining <= 0) break;
              const matches = await bridge.grepSkills(
                skill.diskId,
                query,
                remaining,
              );
              for (const m of matches) {
                allMatches.push({
                  skillName: skill.name,
                  path: m.path,
                  filename: m.filename,
                });
              }
              if (allMatches.length >= limit) break;
            }

            if (allMatches.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: `No matches for "${query}" in skill files.`,
                  },
                ],
                details: { count: 0 },
              };
            }

            const text = allMatches
              .slice(0, limit)
              .map(
                (m, i) =>
                  `${i + 1}. [${m.skillName}] ${m.path}/${m.filename}`,
              )
              .join("\n");

            return {
              content: [
                {
                  type: "text",
                  text: `Found ${allMatches.length} matches:\n\n${text}`,
                },
              ],
              details: {
                count: allMatches.length,
                matches: allMatches.slice(0, limit),
              },
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text",
                  text: `Skill search failed: ${String(err)}`,
                },
              ],
              details: { error: String(err) },
            };
          }
        },
      },
      { name: "acontext_search_skills" },
    );

    api.registerTool(
      {
        name: "acontext_session_history",
        label: "Session History",
        description:
          "Get task summaries from recent past sessions. Use to recall what was done previously.",
        parameters: Type.Object({
          limit: Type.Optional(
            Type.Number({
              description: "Max sessions to include (default: 3)",
            }),
          ),
        }),
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const { limit } = params as { limit?: number };

          try {
            const summaries = await bridge.getRecentSessionSummaries(limit);
            if (!summaries) {
              return {
                content: [
                  { type: "text", text: "No session history available." },
                ],
                details: { count: 0 },
              };
            }

            return {
              content: [
                {
                  type: "text",
                  text: `Recent session history:\n\n${summaries}`,
                },
              ],
              details: { count: summaries.split("</session>").length - 1 },
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text",
                  text: `Session history failed: ${String(err)}`,
                },
              ],
              details: { error: String(err) },
            };
          }
        },
      },
      { name: "acontext_session_history" },
    );

    api.registerTool(
      {
        name: "acontext_learn_now",
        label: "Learn Now",
        description:
          "Trigger skill learning from the current session immediately. Distills reusable skills from this conversation.",
        parameters: Type.Object({}),
        async execute() {
          try {
            if (!currentAcontextSessionId) {
              return {
                content: [
                  {
                    type: "text",
                    text: "No active session to learn from.",
                  },
                ],
                details: { error: "no_session" },
              };
            }

            await bridge.flush(currentAcontextSessionId);

            const result = await bridge.learnFromSession(
              currentAcontextSessionId,
            );
            if (result.status === "skipped") {
              return {
                content: [
                  {
                    type: "text",
                    text: "This session has already been learned.",
                  },
                ],
                details: { skipped: true, sessionId: currentAcontextSessionId },
              };
            }
            if (result.status === "error") {
              return {
                content: [
                  {
                    type: "text",
                    text: "Failed to trigger learning.",
                  },
                ],
                details: { error: "learn_failed" },
              };
            }

            return {
              content: [
                {
                  type: "text",
                  text: `Learning triggered (id: ${result.id}). Skills will be available in ${cfg.skillsDir} once processing completes.`,
                },
              ],
              details: { learningId: result.id, sessionId: currentAcontextSessionId },
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text",
                  text: `Learn failed: ${String(err)}`,
                },
              ],
              details: { error: String(err) },
            };
          }
        },
      },
      { name: "acontext_learn_now" },
    );

    // ========================================================================
    // CLI Commands
    // ========================================================================

    api.registerCli(
      ({ program }: { program: any }) => {
        const ac = program
          .command("acontext")
          .description("Acontext skill memory commands");

        ac.command("skills")
          .description("List learned skills in the Learning Space")
          .action(async () => {
            try {
              const skills = await bridge.listSkills();
              if (skills.length === 0) {
                console.log("No skills learned yet.");
                return;
              }
              for (const skill of skills) {
                const files = skill.fileIndex
                  .map((f) => f.path)
                  .join(", ");
                console.log(`- ${skill.name}: ${skill.description}`);
                if (files) console.log(`  files: ${files}`);
              }
              console.log(`\nTotal: ${skills.length} skills`);
              console.log(`Skills directory: ${cfg.skillsDir}`);
            } catch (err) {
              console.error(`Failed to list skills: ${String(err)}`);
            }
          });

        ac.command("stats")
          .description("Show Acontext memory statistics")
          .action(async () => {
            try {
              const stats = await bridge.getStats();
              console.log(`User: ${cfg.userId}`);
              console.log(`Learning Space: ${stats.learningSpaceId ?? "not created"}`);
              console.log(`Sessions: ${stats.sessionCountIsApproximate ? `${stats.sessionCount}+` : stats.sessionCount}`);
              console.log(`Skills: ${stats.skillCount}`);
              console.log(`Skills directory: ${cfg.skillsDir}`);
              console.log(
                `Auto-capture: ${cfg.autoCapture}, Auto-learn: ${cfg.autoLearn}`,
              );
            } catch (err) {
              console.error(`Stats failed: ${String(err)}`);
            }
          });
      },
      { commands: ["acontext"] },
    );

    // ========================================================================
    // Lifecycle Hooks
    // ========================================================================

    // Skill sync: ensure skills are up-to-date before each agent turn
    api.on("before_agent_start", async (event, ctx) => {
      if (ctx.sessionKey) currentOpenClawSessionKey = ctx.sessionKey;

      try {
        await bridge.listSkills();
      } catch (err) {
        api.logger.warn(`acontext: skill sync check failed: ${String(err)}`);
      }
    });

    // Flush + learn before session is compacted or reset to avoid losing data
    if (cfg.autoCapture) {
      const flushAndLearnIfActive = async () => {
        if (!currentAcontextSessionId || !cfg.autoLearn) return;
        try {
          await bridge.flush(currentAcontextSessionId);
          const result = await bridge.learnFromSession(currentAcontextSessionId);
          if (result.status === "learned") {
            api.logger.info(`acontext: pre-clear learn triggered (learning: ${result.id})`);
          }
        } catch (err) {
          api.logger.warn(`acontext: pre-clear flush/learn failed: ${String(err)}`);
        }
      };

      api.on("before_compaction", async (_event, _ctx) => {
        await flushAndLearnIfActive();
        // Compaction rewrites the message history — flag a cursor reset
        // so the next agent_end re-baselines instead of using the stale offset.
        pendingCursorReset = true;
      });

      api.on("before_reset", async (_event, _ctx) => {
        await flushAndLearnIfActive();
        // Clear session binding so the next agent_end creates a fresh session.
        if (currentOpenClawSessionKey) {
          bridge.clearSessionMapping(currentOpenClawSessionKey);
        }
        currentAcontextSessionId = undefined;
        currentOpenClawSessionKey = undefined;
        capturedTurnCount = 0;
        // Session reset clears the transcript — flag a cursor reset.
        pendingCursorReset = true;
      });
    }

    // Auto-capture + auto-learn: store messages and trigger learning
    if (cfg.autoCapture) {
      api.on("agent_end", async (event, ctx) => {
        if (!event.success || !event.messages || event.messages.length === 0) {
          return;
        }

        if (ctx.sessionKey) currentOpenClawSessionKey = ctx.sessionKey;

        try {
          const openclawKey =
            currentOpenClawSessionKey ?? `default-${cfg.userId}`;
          const sessionId = await bridge.ensureSession(openclawKey);
          currentAcontextSessionId = sessionId;

          // Only store messages we haven't captured yet (incremental).
          const allMessages = event.messages as Record<string, unknown>[];

          // Re-baseline cursor after compaction/reset rewrote the transcript.
          if (pendingCursorReset) {
            api.logger.info(
              `acontext: cursor reset to 0 after compaction/reset — all ${allMessages.length} messages will be re-sent`,
            );
            capturedMessageCursor = 0;
            pendingCursorReset = false;
          }
          const newMessages = allMessages.slice(capturedMessageCursor);
          if (newMessages.length === 0) return;

          const normalized = normalizeMessages(newMessages);
          if (normalized.length === 0) {
            capturedMessageCursor += newMessages.length;
            return;
          }

          const { stored: storedCount } = await bridge.storeMessages(sessionId, normalized as Record<string, unknown>[], capturedMessageCursor);
          // Always advance cursor by original message count since normalization may reduce count
          capturedMessageCursor += newMessages.length;
          capturedTurnCount += 1;

          if (storedCount > 0) {
            api.logger.info(
              `acontext: captured ${storedCount} messages to session ${sessionId}`,
            );
          }

          if (
            cfg.autoLearn &&
            capturedTurnCount >= cfg.minTurnsForLearn
          ) {
            const learnSessionId = sessionId;
            capturedTurnCount = 0;

            bridge
              .flush(learnSessionId)
              .then((flushResult) => {
                if (flushResult.status !== 0) {
                  api.logger.warn(
                    `acontext: flush returned non-zero status before auto-learn: ${flushResult.errmsg}`,
                  );
                }
                return bridge.learnFromSession(learnSessionId);
              })
              .then((result) => {
                if (result.status === "learned") {
                  api.logger.info(
                    `acontext: auto-learn triggered (learning: ${result.id})`,
                  );
                }
              })
              .catch((err) => {
                api.logger.warn(
                  `acontext: auto-learn failed: ${String(err)}`,
                );
              });
          }
        } catch (err) {
          api.logger.warn(`acontext: capture failed: ${String(err)}`);
        }
      });
    }

    // ========================================================================
    // Service
    // ========================================================================

    api.registerService({
      id: "acontext",
      start: (_ctx) => {
        api.logger.info(
          `acontext: service started (user: ${cfg.userId}, autoCapture: ${cfg.autoCapture}, autoLearn: ${cfg.autoLearn})`,
        );
        bridge.syncSkillsToLocal().catch((err) => {
          api.logger.warn(`acontext: initial skill sync failed: ${String(err)}`);
        });
      },
      stop: (_ctx) => {
        api.logger.info("acontext: service stopped");
      },
    });
  },
};

export default acontextPlugin;

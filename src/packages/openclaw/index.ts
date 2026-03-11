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
    messagesObservingStatus(sessionId: string): Promise<{ observed: number; in_process: number; pending: number }>;
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
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
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

export const configSchema = {
  parse(value: unknown): AcontextConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("acontext plugin config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ALLOWED_KEYS, "acontext config");

    if (typeof cfg.apiKey !== "string" || !cfg.apiKey) {
      throw new Error(
        'apiKey is required (set config.apiKey or use "${ACONTEXT_API_KEY}")',
      );
    }

    const resolvedApiKey = resolveEnvVars(cfg.apiKey).trim();
    if (!resolvedApiKey) {
      throw new Error(
        "apiKey resolved to an empty string (check the referenced environment variable)",
      );
    }

    return {
      apiKey: resolvedApiKey,
      baseUrl:
        typeof cfg.baseUrl === "string" && cfg.baseUrl
          ? resolveEnvVars(cfg.baseUrl)
          : "https://api.acontext.app/api/v1",
      userId:
        typeof cfg.userId === "string" && cfg.userId ? cfg.userId : "default",
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

export class AcontextBridge {
  private client: AcontextClientLike | null = null;
  private initPromise: Promise<void> | null = null;
  private sessionMap = new Map<string, string>();
  private learningSpaceId: string | null = null;
  private logger: BridgeLogger;
  private dataDir: string;
  private skillsDir: string;

  private skillsMetadata: SkillMeta[] | null = null;
  private skillsSynced = false;
  private syncInProgress: Promise<SkillMeta[]> | null = null;
  private learnedSessions = new Set<string>();
  private learnedSessionsLoaded = false;
  private sentMessages = new Map<string, Map<string, string>>();
  private sentMessagesLoaded = false;
  private static MANIFEST_STALE_MS = 30 * 60 * 1000; // 30 minutes

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
    } catch {
      // file doesn't exist yet — that's fine
    }
  }

  private async persistLearnedSessions(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(
      this.learnedSessionsPath(),
      JSON.stringify([...this.learnedSessions]),
      "utf-8",
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
    } catch {
      // file doesn't exist yet — that's fine
    }
  }

  private async persistSentMessages(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const data: Record<string, Record<string, string>> = {};
    for (const [sessionId, hashes] of this.sentMessages) {
      data[sessionId] = Object.fromEntries(hashes);
    }
    await fs.writeFile(this.sentMessagesPath(), JSON.stringify(data), "utf-8");
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
    await fs.writeFile(this.manifestPath(), JSON.stringify(manifest), "utf-8");
  }

  /**
   * Download .md files for a single skill to OpenClaw's native skill directory.
   */
  private async downloadSkillFiles(skill: SkillMeta): Promise<void> {
    const client = await this.ensureClient();
    const dir = this.skillDir(skill.name);

    for (const fi of skill.fileIndex) {
      if (!fi.path.endsWith(".md")) continue;

      const fileDest = path.resolve(dir, fi.path);
      if (!fileDest.startsWith(dir + path.sep)) {
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
          await fs.writeFile(fileDest, resp.content.raw, "utf-8");
        } else if (resp.url) {
          const res = await fetch(resp.url);
          if (res.ok) await fs.writeFile(fileDest, await res.text(), "utf-8");
        }
      } catch (err) {
        this.logger.warn(`acontext: download failed for ${skill.id}:${fi.path}: ${String(err)}`);
      }
    }
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
    let downloadCount = 0;

    for (const skill of remoteSkills) {
      remoteIds.add(skill.id);
      const local = localMap.get(skill.id);

      if (!local || local.updatedAt !== skill.updatedAt) {
        if (local && sanitizeSkillName(local.name) !== sanitizeSkillName(skill.name)) {
          const oldDir = this.skillDir(local.name);
          await fs.rm(oldDir, { recursive: true, force: true }).catch(() => {});
        }
        const targetDir = this.skillDir(skill.name);
        await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
        await this.downloadSkillFiles(skill);
        downloadCount++;
      }
    }

    for (const [id, local] of localMap) {
      if (!remoteIds.has(id)) {
        const dir = this.skillDir(local.name);
        await fs.rm(dir, { recursive: true, force: true }).catch((err) => {
          this.logger.warn(`acontext: failed to remove deleted skill dir ${dir}: ${String(err)}`);
        });
      }
    }

    await this.writeManifest(remoteSkills);
    this.skillsMetadata = remoteSkills;
    this.skillsSynced = true;

    if (downloadCount > 0) {
      this.logger.info(`acontext: synced ${downloadCount} skill(s) to ${this.skillsDir} (${remoteSkills.length} total)`);
    }
    return remoteSkills;
  }

  private async ensureClient(): Promise<AcontextClientLike> {
    if (this.client) return this.client;
    if (!this.initPromise) this.initPromise = this._init();
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
    const client = await this.ensureClient();

    const cached = this.sessionMap.get(openclawSessionKey);
    if (cached) return cached;

    try {
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
    } catch (err) {
      this.logger.warn(`acontext: session lookup failed, creating new: ${String(err)}`);
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
    const client = await this.ensureClient();

    if (this.learningSpaceId) return this.learningSpaceId;

    try {
      const existing = await client.learningSpaces.list({
        user: this.cfg.userId,
        filterByMeta: { source: "openclaw" },
        limit: 1,
      });
      if (existing.items.length > 0) {
        this.learningSpaceId = existing.items[0].id;
        return this.learningSpaceId!;
      }
    } catch (err) {
      this.logger.warn(`acontext: learning space lookup failed, creating new: ${String(err)}`);
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
        const summary = await client.sessions.getSessionSummary(
          session.id,
          { limit: 20 },
        );
        if (summary) {
          parts.push(
            `<session id="${session.id}" created="${session.created_at}">\n${summary}\n</session>`,
          );
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
  ): Promise<number> {
    if (!this.sentMessagesLoaded) {
      await this.loadSentMessages();
      this.sentMessagesLoaded = true;
    }

    const client = await this.ensureClient();
    let sessionSent = this.sentMessages.get(sessionId);
    if (!sessionSent) {
      sessionSent = new Map();
      this.sentMessages.set(sessionId, sessionSent);
    }

    let stored = 0;
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const hash = AcontextBridge.computeMessageHash(startIndex + i, blob);

      if (sessionSent.has(hash)) {
        this.logger.info(`acontext: skipping duplicate message ${hash}`);
        continue;
      }

      try {
        const result = await client.sessions.storeMessage(sessionId, blob, { format: "openai" });
        sessionSent.set(hash, result.id);
        stored++;
      } catch (err) {
        this.logger.warn(`acontext: storeMessage failed at index ${startIndex + i}: ${String(err)}`);
        break;
      }
    }

    if (stored > 0) {
      await this.persistSentMessages();
    }
    return stored;
  }

  async flush(sessionId: string): Promise<void> {
    const client = await this.ensureClient();
    await client.sessions.flush(sessionId);
  }

  async waitForProcessing(
    sessionId: string,
    timeoutMs = 30_000,
  ): Promise<boolean> {
    const client = await this.ensureClient();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const status =
          await client.sessions.messagesObservingStatus(sessionId);
        if (status.pending === 0 && status.in_process === 0) return true;
      } catch (err) {
        this.logger.warn(`acontext: waitForProcessing poll failed: ${String(err)}`);
        return false;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  }

  // -- Learn -------------------------------------------------------------------

  async learnFromSession(sessionId: string): Promise<LearnResult> {
    if (!this.learnedSessionsLoaded) {
      await this.loadLearnedSessions();
      this.learnedSessionsLoaded = true;
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
  version: "0.1.5",
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

          const storedCount = await bridge.storeMessages(sessionId, newMessages, capturedMessageCursor);
          // Advance cursor by total newMessages.length (including skipped duplicates)
          // so the cursor controls slice efficiency; dedup is handled by hash.
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
              .then(() => bridge.learnFromSession(learnSessionId))
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

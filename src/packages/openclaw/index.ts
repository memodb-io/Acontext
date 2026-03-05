/**
 * OpenClaw Acontext Plugin
 *
 * Skill memory for OpenClaw agents — captures conversations, extracts tasks,
 * distills reusable skills, and recalls them in future sessions.
 *
 * Features:
 * - Auto-capture: stores each agent turn to an Acontext session
 * - Auto-recall: injects learned skills + task history before each turn
 * - Auto-learn: triggers Learning Space skill distillation after sessions
 * - 4 tools: acontext_search_skills, acontext_read_skill, acontext_session_history, acontext_learn_now
 * - CLI: openclaw acontext skills, openclaw acontext stats
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

// ============================================================================
// Types
// ============================================================================

export type AcontextConfig = {
  apiKey: string;
  baseUrl: string;
  userId: string;
  learningSpaceId?: string;
  autoCapture: boolean;
  autoRecall: boolean;
  autoLearn: boolean;
  maxSkillFiles: number;
  maxSkillFileTokens: number;
  maxTaskSummaryTokens: number;
  recallSessionCount: number;
  minTurnsForLearn: number;
};

/**
 * Minimal interface for the subset of AcontextClient used by this plugin.
 * Avoids `any` while keeping the dynamic import pattern.
 */
interface AcontextClientLike {
  sessions: {
    list(options?: Record<string, unknown>): Promise<{ items: Array<{ id: string; created_at?: string }>; has_more: boolean }>;
    create(options?: Record<string, unknown>): Promise<{ id: string }>;
    storeMessage(sessionId: string, blob: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
    flush(sessionId: string): Promise<{ status: number; errmsg: string }>;
    messagesObservingStatus(sessionId: string): Promise<{ observed: number; in_process: number; pending: number }>;
    getSessionSummary(sessionId: string, options?: Record<string, unknown>): Promise<string>;
  };
  learningSpaces: {
    list(options?: Record<string, unknown>): Promise<{ items: Array<{ id: string }>; has_more: boolean }>;
    create(options?: Record<string, unknown>): Promise<{ id: string }>;
    listSkills(spaceId: string): Promise<Array<{ id: string; name: string; description: string; disk_id: string; file_index?: Array<{ path: string; mime: string }> }>>;
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
  "autoCapture",
  "autoRecall",
  "autoLearn",
  "maxSkillFiles",
  "maxSkillFileTokens",
  "maxTaskSummaryTokens",
  "recallSessionCount",
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

    return {
      apiKey: resolveEnvVars(cfg.apiKey),
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
      autoCapture: cfg.autoCapture !== false,
      autoRecall: cfg.autoRecall !== false,
      autoLearn: cfg.autoLearn !== false,
      maxSkillFiles:
        typeof cfg.maxSkillFiles === "number" ? cfg.maxSkillFiles : 10,
      maxSkillFileTokens:
        typeof cfg.maxSkillFileTokens === "number"
          ? cfg.maxSkillFileTokens
          : 2000,
      maxTaskSummaryTokens:
        typeof cfg.maxTaskSummaryTokens === "number"
          ? cfg.maxTaskSummaryTokens
          : 1500,
      recallSessionCount:
        typeof cfg.recallSessionCount === "number"
          ? cfg.recallSessionCount
          : 3,
      minTurnsForLearn:
        typeof cfg.minTurnsForLearn === "number" ? cfg.minTurnsForLearn : 4,
    };
  },
};

// ============================================================================
// Acontext Client Wrapper
// ============================================================================

export interface BridgeLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

type SkillMeta = { id: string; name: string; description: string; diskId: string; fileIndex: Array<{ path: string; mime: string }> };

interface SkillManifest {
  syncedAt: number;
  skills: SkillMeta[];
}

export class AcontextBridge {
  private client: AcontextClientLike | null = null;
  private initPromise: Promise<void> | null = null;
  private sessionMap = new Map<string, string>();
  private learningSpaceId: string | null = null;
  private logger: BridgeLogger;
  private dataDir: string;

  private skillsMetadata: SkillMeta[] | null = null;
  private skillsSynced = false;
  private static MANIFEST_STALE_MS = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly cfg: AcontextConfig, dataDir: string, logger?: BridgeLogger) {
    this.dataDir = dataDir;
    this.logger = logger ?? { info: () => {}, warn: () => {} };
    if (cfg.learningSpaceId) {
      this.learningSpaceId = cfg.learningSpaceId;
    }
  }

  private manifestPath(): string {
    return path.join(this.dataDir, ".manifest.json");
  }

  private skillDir(skillId: string): string {
    return path.join(this.dataDir, skillId);
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
   * Download .md files for a single skill to local disk.
   */
  private async downloadSkillFiles(skill: SkillMeta): Promise<void> {
    const client = await this.ensureClient();
    const dir = this.skillDir(skill.id);

    for (const fi of skill.fileIndex) {
      if (!fi.path.endsWith(".md")) continue;

      const fileDest = path.join(dir, fi.path);
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
   * Sync all skills from API to local disk.
   * Only downloads files for skills whose local directory doesn't exist yet.
   */
  private async syncSkillsToLocal(): Promise<SkillMeta[]> {
    const client = await this.ensureClient();
    const spaceId = await this.ensureLearningSpace();
    const rawSkills = await client.learningSpaces.listSkills(spaceId);
    const skills: SkillMeta[] = rawSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      diskId: s.disk_id,
      fileIndex: s.file_index ?? [],
    }));

    for (const skill of skills) {
      const dir = this.skillDir(skill.id);
      try {
        await fs.access(dir);
      } catch {
        await this.downloadSkillFiles(skill);
      }
    }

    await this.writeManifest(skills);
    this.skillsMetadata = skills;
    this.skillsSynced = true;
    this.logger.info(`acontext: synced ${skills.length} skills to ${this.dataDir}`);
    return skills;
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

  /**
   * Get or create an Acontext session mapped to an OpenClaw session key.
   */
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

  /**
   * Get or create a Learning Space for this user.
   */
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

  // -- Skill recall ----------------------------------------------------------

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

  async getSkillFile(
    skillId: string,
    filePath: string,
  ): Promise<string | null> {
    const localPath = path.join(this.skillDir(skillId), filePath);

    try {
      return await fs.readFile(localPath, "utf-8");
    } catch {
      // Not on disk — fetch from API and save locally
    }

    const client = await this.ensureClient();
    try {
      const resp = await client.skills.getFile({
        skillId,
        filePath,
        expire: 60,
      });
      let content: string | null = null;
      if (resp.content) {
        content = resp.content.raw;
      } else if (resp.url) {
        const res = await fetch(resp.url);
        if (res.ok) content = await res.text();
      }
      if (content) {
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, content, "utf-8");
      }
      return content;
    } catch (err) {
      this.logger.warn(`acontext: getSkillFile failed for ${skillId}:${filePath}: ${String(err)}`);
      return null;
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

  // -- Task recall -----------------------------------------------------------

  async getRecentSessionSummaries(limitOverride?: number): Promise<string> {
    const client = await this.ensureClient();
    try {
      const sessions = await client.sessions.list({
        user: this.cfg.userId,
        limit: limitOverride ?? this.cfg.recallSessionCount,
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

  async getSessionSummary(sessionId: string): Promise<string> {
    const client = await this.ensureClient();
    try {
      return await client.sessions.getSessionSummary(sessionId, {
        limit: 50,
      });
    } catch (err) {
      this.logger.warn(`acontext: getSessionSummary failed for ${sessionId}: ${String(err)}`);
      return "";
    }
  }

  // -- Capture ---------------------------------------------------------------

  async storeMessage(
    sessionId: string,
    role: string,
    content: string,
  ): Promise<void> {
    const client = await this.ensureClient();
    await client.sessions.storeMessage(
      sessionId,
      { role, content },
      { format: "openai" },
    );
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

  // -- Learn -----------------------------------------------------------------

  async learnFromSession(sessionId: string): Promise<string | null> {
    const client = await this.ensureClient();
    const spaceId = await this.ensureLearningSpace();
    try {
      const result = await client.learningSpaces.learn({
        spaceId,
        sessionId,
      });
      this.invalidateSkillCaches();
      return result.id;
    } catch (err) {
      this.logger.warn(`acontext: learnFromSession failed for ${sessionId}: ${String(err)}`);
      return null;
    }
  }

  invalidateSkillCaches(): void {
    this.skillsMetadata = null;
    this.skillsSynced = false;
    fs.rm(this.dataDir, { recursive: true, force: true }).catch((err) => {
      this.logger.warn(`acontext: failed to remove skills cache dir: ${String(err)}`);
    });
  }

  // -- Stats -----------------------------------------------------------------

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
// Helpers
// ============================================================================

export function truncateByTokenEstimate(text: string, maxTokens: number): string {
  // Conservative estimate: ~3 chars per token (between 4 for English and 2 for CJK)
  const maxChars = maxTokens * 3;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... (truncated)";
}

export function stripInjectedContext(text: string): string {
  return text
    .replace(/<acontext-context>[\s\S]*?<\/acontext-context>\s*/g, "")
    .trim();
}

// ============================================================================
// Plugin Definition
// ============================================================================

const acontextPlugin = {
  id: "acontext",
  name: "Acontext Skill Memory",
  description:
    "Acontext skill memory — auto-capture, auto-recall, auto-learn across sessions",
  kind: "memory" as const,
  configSchema,

  register(api: OpenClawPluginApi) {
    const cfg = configSchema.parse(api.pluginConfig);
    const skillsDir = api.resolvePath("skills");
    const bridge = new AcontextBridge(cfg, skillsDir, api.logger);

    let currentOpenClawSessionKey: string | undefined;
    let currentAcontextSessionId: string | undefined;
    let capturedTurnCount = 0;

    api.logger.info(
      `acontext: registered (user: ${cfg.userId}, autoRecall: ${cfg.autoRecall}, autoCapture: ${cfg.autoCapture}, autoLearn: ${cfg.autoLearn})`,
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

            // Grep across all skill disks
            const allMatches: Array<{
              skillName: string;
              path: string;
              filename: string;
            }> = [];

            for (const skill of skills) {
              if (!skill.diskId) continue;
              const matches = await bridge.grepSkills(
                skill.diskId,
                query,
                limit,
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
        name: "acontext_read_skill",
        label: "Read Skill",
        description:
          "Read the full content of a learned skill file. Use to retrieve detailed knowledge.",
        parameters: Type.Object({
          skillName: Type.String({
            description: "Name of the skill to read",
          }),
          filePath: Type.Optional(
            Type.String({
              description:
                'Path to a specific file within the skill (default: first .md file)',
            }),
          ),
        }),
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const { skillName, filePath } = params as {
            skillName: string;
            filePath?: string;
          };

          try {
            const skills = await bridge.listSkills();
            const skill = skills.find(
              (s) => s.name.toLowerCase() === skillName.toLowerCase(),
            );
            if (!skill) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Skill "${skillName}" not found. Available: ${skills.map((s) => s.name).join(", ") || "none"}`,
                  },
                ],
                details: { error: "not_found" },
              };
            }

            const targetPath =
              filePath ??
              skill.fileIndex.find((f) => f.path.endsWith(".md"))?.path ??
              skill.fileIndex[0]?.path;

            if (!targetPath) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Skill "${skillName}" has no files.`,
                  },
                ],
                details: { error: "no_files" },
              };
            }

            const content = await bridge.getSkillFile(skill.id, targetPath);
            if (!content) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Could not read file "${targetPath}" from skill "${skillName}".`,
                  },
                ],
                details: { error: "read_failed" },
              };
            }

            return {
              content: [
                {
                  type: "text",
                  text: `# ${skill.name}: ${targetPath}\n\n${content}`,
                },
              ],
              details: {
                skillId: skill.id,
                skillName: skill.name,
                filePath: targetPath,
              },
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text",
                  text: `Read skill failed: ${String(err)}`,
                },
              ],
              details: { error: String(err) },
            };
          }
        },
      },
      { name: "acontext_read_skill" },
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
              description: `Max sessions to include (default: ${cfg.recallSessionCount})`,
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

            // flush() is synchronous — blocks until CORE finishes task extraction
            await bridge.flush(currentAcontextSessionId);

            const learningId = await bridge.learnFromSession(
              currentAcontextSessionId,
            );
            if (!learningId) {
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
                  text: `Learning triggered (id: ${learningId}). Skills will be available once processing completes.`,
                },
              ],
              details: { learningId, sessionId: currentAcontextSessionId },
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
              console.log(
                `Auto-recall: ${cfg.autoRecall}, Auto-capture: ${cfg.autoCapture}, Auto-learn: ${cfg.autoLearn}`,
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

    // Auto-recall: inject skills + task history before agent starts
    if (cfg.autoRecall) {
      api.on("before_agent_start", async (event, ctx) => {
        if (!event.prompt || event.prompt.length < 5) return;

        const sessionKey = (ctx as any)?.sessionKey ?? undefined;
        if (sessionKey) currentOpenClawSessionKey = sessionKey;

        try {
          const contextParts: string[] = [];

          // 1. Skill recall — read learned skill file contents
          const skills = await bridge.listSkills();
          if (skills.length > 0) {
            const skillTexts: string[] = [];
            let fileCount = 0;

            for (const skill of skills) {
              if (fileCount >= cfg.maxSkillFiles) break;

              for (const fileInfo of skill.fileIndex) {
                if (fileCount >= cfg.maxSkillFiles) break;
                if (!fileInfo.path.endsWith(".md")) continue;

                const content = await bridge.getSkillFile(
                  skill.id,
                  fileInfo.path,
                );
                if (content) {
                  skillTexts.push(
                    `### ${skill.name}: ${fileInfo.path}\n${truncateByTokenEstimate(content, cfg.maxSkillFileTokens)}`,
                  );
                  fileCount++;
                }
              }
            }

            if (skillTexts.length > 0) {
              contextParts.push(
                `<acontext-skills>\nThe following skills were learned from previous sessions:\n\n${skillTexts.join("\n\n")}\n</acontext-skills>`,
              );
            }
          }

          // 2. Task recall — recent session task summaries
          const taskSummaries = await bridge.getRecentSessionSummaries();
          if (taskSummaries) {
            const truncated = truncateByTokenEstimate(
              taskSummaries,
              cfg.maxTaskSummaryTokens,
            );
            contextParts.push(
              `<acontext-tasks>\nRecent task history from past sessions:\n\n${truncated}\n</acontext-tasks>`,
            );
          }

          if (contextParts.length === 0) return;

          const totalContext = `<acontext-context>\n${contextParts.join("\n\n")}\n</acontext-context>`;

          api.logger.info(
            `acontext: injecting context (${skills.length} skills, ${contextParts.length} sections, ${totalContext.length} chars)`,
          );

          return { prependContext: totalContext };
        } catch (err) {
          api.logger.warn(`acontext: recall failed: ${String(err)}`);
        }
      });
    }

    // Auto-capture + auto-learn: store messages and trigger learning
    if (cfg.autoCapture) {
      api.on("agent_end", async (event, ctx) => {
        if (!event.success || !event.messages || event.messages.length === 0) {
          return;
        }

        const sessionKey = (ctx as any)?.sessionKey ?? undefined;
        if (sessionKey) currentOpenClawSessionKey = sessionKey;

        try {
          // Resolve Acontext session
          const openclawKey =
            currentOpenClawSessionKey ?? `default-${cfg.userId}`;
          const sessionId = await bridge.ensureSession(openclawKey);
          currentAcontextSessionId = sessionId;

          // Extract and store messages
          const recentMessages = event.messages.slice(-20);
          let storedCount = 0;

          for (const msg of recentMessages) {
            if (!msg || typeof msg !== "object") continue;
            const msgObj = msg as Record<string, unknown>;

            const role = msgObj.role;
            if (role !== "user" && role !== "assistant") continue;

            let textContent = "";
            const content = msgObj.content;

            if (typeof content === "string") {
              textContent = content;
            } else if (Array.isArray(content)) {
              for (const block of content) {
                if (
                  block &&
                  typeof block === "object" &&
                  "text" in block &&
                  typeof (block as Record<string, unknown>).text === "string"
                ) {
                  textContent +=
                    (textContent ? "\n" : "") +
                    ((block as Record<string, unknown>).text as string);
                }
              }
            }

            if (!textContent) continue;

            // Strip injected context before storing
            textContent = stripInjectedContext(textContent);
            if (!textContent) continue;

            await bridge.storeMessage(sessionId, role as string, textContent);
            storedCount++;
          }

          capturedTurnCount += storedCount;

          if (storedCount > 0) {
            api.logger.info(
              `acontext: captured ${storedCount} messages to session ${sessionId}`,
            );
          }

          // Auto-learn: flush + learn in background to avoid blocking the hook.
          // flush() is synchronous (blocks until CORE finishes task extraction),
          // so the entire chain runs as a detached promise.
          if (
            cfg.autoLearn &&
            capturedTurnCount >= cfg.minTurnsForLearn * 2 // *2 because user+assistant = 2 messages per turn
          ) {
            const learnSessionId = sessionId;
            capturedTurnCount = 0;

            bridge
              .flush(learnSessionId)
              .then(() => bridge.learnFromSession(learnSessionId))
              .then((learningId) => {
                if (learningId) {
                  api.logger.info(
                    `acontext: auto-learn triggered (learning: ${learningId})`,
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
      start: () => {
        api.logger.info(
          `acontext: service started (user: ${cfg.userId}, autoRecall: ${cfg.autoRecall}, autoCapture: ${cfg.autoCapture}, autoLearn: ${cfg.autoLearn})`,
        );
      },
      stop: () => {
        api.logger.info("acontext: service stopped");
      },
    });
  },
};

export default acontextPlugin;

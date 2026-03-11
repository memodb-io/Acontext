/**
 * AcontextBridge for Claude Code plugin.
 *
 * Adapted from src/packages/openclaw/index.ts — reuses the core logic for
 * client initialization, session management, message capture, learning,
 * and skill querying. Removes OpenClaw-specific getTranscript/cursor logic
 * and skill-sync-to-local-directory logic (Claude Code uses MCP tools instead).
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AcontextConfig } from "./config";

// ============================================================================
// Types
// ============================================================================

interface AcontextClientLike {
  sessions: {
    list(
      options?: Record<string, unknown>,
    ): Promise<{
      items: Array<{ id: string; created_at?: string }>;
      has_more: boolean;
    }>;
    create(options?: Record<string, unknown>): Promise<{ id: string }>;
    storeMessage(
      sessionId: string,
      blob: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<{ id: string }>;
    flush(sessionId: string): Promise<{ status: number; errmsg: string }>;
    getSessionSummary(
      sessionId: string,
      options?: Record<string, unknown>,
    ): Promise<string>;
  };
  learningSpaces: {
    list(
      options?: Record<string, unknown>,
    ): Promise<{ items: Array<{ id: string }>; has_more: boolean }>;
    create(options?: Record<string, unknown>): Promise<{ id: string }>;
    listSkills(
      spaceId: string,
    ): Promise<
      Array<{
        id: string;
        name: string;
        description: string;
        disk_id: string;
        file_index?: Array<{ path: string; mime: string }>;
        updated_at: string;
      }>
    >;
    learn(options: {
      spaceId: string;
      sessionId: string;
    }): Promise<{ id: string }>;
  };
  skills: {
    getFile(options: {
      skillId: string;
      filePath: string;
      expire?: number;
    }): Promise<{
      content?: { type: string; raw: string } | null;
      url?: string | null;
    }>;
  };
  artifacts: {
    grepArtifacts(
      diskId: string,
      options: { query: string; limit?: number },
    ): Promise<Array<{ path: string; filename: string }>>;
  };
}

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

// ============================================================================
// Utilities
// ============================================================================

let atomicWriteCounter = 0;
async function atomicWriteFile(
  filePath: string,
  data: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath =
    filePath + `.tmp.${process.pid}.${Date.now()}.${atomicWriteCounter++}`;
  await fs.writeFile(tmpPath, data, "utf-8");
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

// ============================================================================
// AcontextBridge
// ============================================================================

const SOURCE_TAG = "claude-code";

export class AcontextBridge {
  private client: AcontextClientLike | null = null;
  private initPromise: Promise<void> | null = null;
  private sessionId: string | null = null;
  private sessionPromise: Promise<string> | null = null;
  private learningSpaceId: string | null = null;
  private learningSpacePromise: Promise<string> | null = null;
  private logger: BridgeLogger;
  private dataDir: string;

  private learnedSessions = new Set<string>();
  private learnedSessionsLoaded = false;
  private learnedSessionsLoadPromise: Promise<void> | null = null;
  private sentMessages = new Map<string, Map<string, string>>();
  private sentMessagesLoaded = false;
  private sentMessagesLoadPromise: Promise<void> | null = null;

  private turnCount = 0;
  private lastProcessedIndex = 0;

  static MAX_SENT_SESSIONS = 100;
  static MAX_LEARNED_SESSIONS = 500;

  constructor(
    private readonly cfg: AcontextConfig,
    dataDir: string,
    logger?: BridgeLogger,
  ) {
    this.dataDir = dataDir;
    this.logger = logger ?? { info: () => {}, warn: () => {} };
    if (cfg.learningSpaceId) {
      this.learningSpaceId = cfg.learningSpaceId;
    }
  }

  // -- Persistence paths ----------------------------------------------------

  private sessionStatePath(): string {
    return path.join(this.dataDir, ".session-state.json");
  }

  private learnedSessionsPath(): string {
    return path.join(this.dataDir, ".learned-sessions.json");
  }

  private sentMessagesPath(): string {
    return path.join(this.dataDir, ".sent-messages.json");
  }

  // -- Session state persistence (across hook processes) --------------------

  async saveSessionState(): Promise<void> {
    if (!this.sessionId) return;
    await fs.mkdir(this.dataDir, { recursive: true });
    await atomicWriteFile(
      this.sessionStatePath(),
      JSON.stringify({
        sessionId: this.sessionId,
        turnCount: this.turnCount,
        lastProcessedIndex: this.lastProcessedIndex,
        timestamp: Date.now(),
      }),
    );
  }

  async loadSessionState(): Promise<boolean> {
    try {
      const raw = await fs.readFile(this.sessionStatePath(), "utf-8");
      const state = JSON.parse(raw) as {
        sessionId: string;
        turnCount: number;
        lastProcessedIndex?: number;
        timestamp: number;
      };
      // Only restore if less than 24 hours old
      if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
        return false;
      }
      this.sessionId = state.sessionId;
      this.turnCount = state.turnCount;
      this.lastProcessedIndex = state.lastProcessedIndex ?? 0;
      return true;
    } catch {
      return false;
    }
  }

  async clearSessionState(): Promise<void> {
    await fs.unlink(this.sessionStatePath()).catch(() => {});
  }

  // -- Learned sessions persistence -----------------------------------------

  private async loadLearnedSessions(): Promise<void> {
    try {
      const raw = await fs.readFile(this.learnedSessionsPath(), "utf-8");
      const ids = JSON.parse(raw) as string[];
      for (const id of ids) this.learnedSessions.add(id);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        this.logger.warn(
          `acontext: failed to load learned-sessions state: ${String(err)}`,
        );
      }
    }
  }

  private async persistLearnedSessions(): Promise<void> {
    if (this.learnedSessions.size > AcontextBridge.MAX_LEARNED_SESSIONS) {
      const arr = [...this.learnedSessions];
      const toKeep = arr.slice(
        arr.length - AcontextBridge.MAX_LEARNED_SESSIONS,
      );
      this.learnedSessions = new Set(toKeep);
    }
    await fs.mkdir(this.dataDir, { recursive: true });
    await atomicWriteFile(
      this.learnedSessionsPath(),
      JSON.stringify([...this.learnedSessions]),
    );
  }

  // -- Sent messages persistence --------------------------------------------

  private async loadSentMessages(): Promise<void> {
    try {
      const raw = await fs.readFile(this.sentMessagesPath(), "utf-8");
      const data = JSON.parse(raw) as Record<string, Record<string, string>>;
      for (const [sessionId, hashes] of Object.entries(data)) {
        this.sentMessages.set(sessionId, new Map(Object.entries(hashes)));
      }
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        this.logger.warn(
          `acontext: failed to load sent-messages state: ${String(err)}`,
        );
      }
    }
  }

  private async persistSentMessages(): Promise<void> {
    if (this.sentMessages.size > AcontextBridge.MAX_SENT_SESSIONS) {
      const keys = [...this.sentMessages.keys()];
      const toRemove = keys.slice(
        0,
        keys.length - AcontextBridge.MAX_SENT_SESSIONS,
      );
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

  static computeMessageHash(
    index: number,
    blob: Record<string, unknown>,
  ): string {
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ i: index, r: blob.role, c: blob.content }))
      .digest("hex")
      .slice(0, 16);
    return `${index}:${hash}`;
  }

  // -- Client initialization ------------------------------------------------

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

  // -- Session management ---------------------------------------------------

  async ensureSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    if (this.sessionPromise) return this.sessionPromise;

    this.sessionPromise = this._createSession().then(
      (result) => {
        this.sessionPromise = null;
        return result;
      },
      (err) => {
        this.sessionPromise = null;
        throw err;
      },
    );
    return this.sessionPromise;
  }

  private async _createSession(): Promise<string> {
    const client = await this.ensureClient();
    const session = await client.sessions.create({
      user: this.cfg.userId,
      configs: {
        source: SOURCE_TAG,
      },
    });
    this.sessionId = session.id;
    this.turnCount = 0;
    this.lastProcessedIndex = 0;
    this.logger.info(`acontext: created session ${session.id}`);
    return session.id;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getTurnCount(): number {
    return this.turnCount;
  }

  incrementTurnCount(): void {
    this.turnCount++;
  }

  getLastProcessedIndex(): number {
    return this.lastProcessedIndex;
  }

  setLastProcessedIndex(index: number): void {
    this.lastProcessedIndex = index;
  }

  // -- Learning space management --------------------------------------------

  async ensureLearningSpace(): Promise<string> {
    if (this.learningSpaceId) return this.learningSpaceId;
    if (this.learningSpacePromise) return this.learningSpacePromise;

    this.learningSpacePromise = this._createOrFindLearningSpace().then(
      (result) => {
        this.learningSpacePromise = null;
        return result;
      },
      (err) => {
        this.learningSpacePromise = null;
        throw err;
      },
    );
    return this.learningSpacePromise;
  }

  private async _createOrFindLearningSpace(): Promise<string> {
    const client = await this.ensureClient();
    const existing = await client.learningSpaces.list({
      user: this.cfg.userId,
      filterByMeta: { source: SOURCE_TAG },
      limit: 1,
    });
    if (existing.items.length > 0) {
      this.learningSpaceId = existing.items[0].id;
      return this.learningSpaceId!;
    }

    const space = await client.learningSpaces.create({
      user: this.cfg.userId,
      meta: { source: SOURCE_TAG },
    });
    this.learningSpaceId = space.id;
    return this.learningSpaceId!;
  }

  // -- Message capture ------------------------------------------------------

  async storeMessages(
    sessionId: string,
    blobs: Record<string, unknown>[],
    startIndex = 0,
  ): Promise<{ stored: number; processed: number }> {
    if (!this.sentMessagesLoaded) {
      if (!this.sentMessagesLoadPromise) {
        this.sentMessagesLoadPromise = this.loadSentMessages()
          .then(() => {
            this.sentMessagesLoaded = true;
            this.sentMessagesLoadPromise = null;
          })
          .catch((err) => {
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
        processed++;
        continue;
      }

      try {
        const result = await client.sessions.storeMessage(sessionId, blob, {
          format: "anthropic",
        });
        sessionSent.set(hash, result.id);
        stored++;
        processed++;
      } catch (err) {
        this.logger.warn(
          `acontext: storeMessage failed at index ${startIndex + i}: ${String(err)}`,
        );
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

  // -- Learning -------------------------------------------------------------

  async learnFromSession(sessionId: string): Promise<LearnResult> {
    if (!this.learnedSessionsLoaded) {
      if (!this.learnedSessionsLoadPromise) {
        this.learnedSessionsLoadPromise = this.loadLearnedSessions()
          .then(() => {
            this.learnedSessionsLoaded = true;
            this.learnedSessionsLoadPromise = null;
          })
          .catch((err) => {
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
      return { status: "learned", id: result.id };
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already learned")) {
        this.learnedSessions.add(sessionId);
        await this.persistLearnedSessions();
        this.logger.info(
          `acontext: session ${sessionId} already learned, skipping`,
        );
        return { status: "skipped" };
      }
      this.logger.warn(
        `acontext: learnFromSession failed for ${sessionId}: ${msg}`,
      );
      return { status: "error" };
    }
  }

  // -- Skill querying -------------------------------------------------------

  async listSkills(): Promise<SkillMeta[]> {
    const client = await this.ensureClient();
    const spaceId = await this.ensureLearningSpace();
    const rawSkills = await client.learningSpaces.listSkills(spaceId);
    return rawSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      diskId: s.disk_id,
      fileIndex: s.file_index ?? [],
      updatedAt: s.updated_at,
    }));
  }

  async grepSkills(
    diskId: string,
    query: string,
    limit = 10,
  ): Promise<Array<{ path: string; filename: string }>> {
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
      this.logger.warn(
        `acontext: grepSkills failed for disk ${diskId}: ${String(err)}`,
      );
      return [];
    }
  }

  async getSkillFileContent(
    skillId: string,
    filePath: string,
  ): Promise<string> {
    const client = await this.ensureClient();
    const resp = await client.skills.getFile({
      skillId,
      filePath,
      expire: 60,
    });
    if (resp.content) {
      if (resp.content.type === "base64") {
        return Buffer.from(resp.content.raw, "base64").toString("utf-8");
      }
      return resp.content.raw;
    }
    if (resp.url) {
      const res = await fetch(resp.url);
      if (res.ok) {
        return await res.text();
      }
      throw new Error(`Failed to fetch skill file: ${res.status}`);
    }
    throw new Error("No content available for this skill file");
  }

  // -- Session history ------------------------------------------------------

  async getRecentSessionSummaries(limit = 3): Promise<string> {
    const client = await this.ensureClient();
    try {
      const sessions = await client.sessions.list({
        user: this.cfg.userId,
        limit,
        timeDesc: true,
        filterByConfigs: { source: SOURCE_TAG },
      });

      if (!sessions.items.length) return "";

      const results = await Promise.all(
        sessions.items.map(async (session) => {
          try {
            const summary = await client.sessions.getSessionSummary(
              session.id,
              { limit: 20 },
            );
            if (summary) {
              return `<session id="${session.id}" created="${session.created_at}">\n${summary}\n</session>`;
            }
          } catch (err) {
            this.logger.warn(
              `acontext: getSessionSummary failed for ${session.id}: ${String(err)}`,
            );
          }
          return null;
        }),
      );
      return results.filter(Boolean).join("\n");
    } catch (err) {
      this.logger.warn(
        `acontext: getRecentSessionSummaries failed: ${String(err)}`,
      );
      return "";
    }
  }
}

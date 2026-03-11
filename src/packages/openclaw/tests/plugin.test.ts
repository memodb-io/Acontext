/**
 * Unit tests for @acontext/openclaw plugin.
 *
 * Tests config parsing, helper functions, AcontextBridge logic,
 * and plugin hook behavior using mocks.
 */

import { jest, describe, test, expect, beforeEach, afterEach, afterAll } from "@jest/globals";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  resolveEnvVars,
  assertAllowedKeys,
  configSchema,
  sanitizeSkillName,
  AcontextBridge,
  type AcontextConfig,
  type BridgeLogger,
  type LearnResult,
} from "../index";

// ============================================================================
// Config Parsing
// ============================================================================

describe("resolveEnvVars", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("resolves a single env var", () => {
    process.env.MY_KEY = "secret123";
    expect(resolveEnvVars("${MY_KEY}")).toBe("secret123");
  });

  test("resolves multiple env vars in one string", () => {
    process.env.HOST = "localhost";
    process.env.PORT = "8080";
    expect(resolveEnvVars("http://${HOST}:${PORT}")).toBe(
      "http://localhost:8080",
    );
  });

  test("returns string unchanged if no env vars", () => {
    expect(resolveEnvVars("plain-string")).toBe("plain-string");
  });

  test("throws on unset env var", () => {
    delete process.env.MISSING_VAR;
    expect(() => resolveEnvVars("${MISSING_VAR}")).toThrow(
      "Environment variable MISSING_VAR is not set",
    );
  });
});

describe("assertAllowedKeys", () => {
  test("passes for known keys only", () => {
    expect(() =>
      assertAllowedKeys({ a: 1, b: 2 }, ["a", "b", "c"], "test"),
    ).not.toThrow();
  });

  test("throws listing unknown keys", () => {
    expect(() =>
      assertAllowedKeys({ a: 1, x: 2, y: 3 }, ["a"], "myConfig"),
    ).toThrow("myConfig has unknown keys: x, y");
  });
});

describe("configSchema.parse", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ACONTEXT_API_KEY: "sk-ac-test" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("parses minimal valid config with env var", () => {
    const cfg = configSchema.parse({
      apiKey: "${ACONTEXT_API_KEY}",
    });
    expect(cfg.apiKey).toBe("sk-ac-test");
    expect(cfg.userId).toBe("default");
    expect(cfg.baseUrl).toBe("https://api.acontext.app/api/v1");
  });

  test("parses config with all fields", () => {
    const cfg = configSchema.parse({
      apiKey: "sk-ac-literal",
      baseUrl: "http://localhost:3000",
      userId: "alice",
      learningSpaceId: "space-123",
      skillsDir: "/custom/skills",
      autoCapture: false,
      autoLearn: false,
      minTurnsForLearn: 6,
    });
    expect(cfg.apiKey).toBe("sk-ac-literal");
    expect(cfg.baseUrl).toBe("http://localhost:3000");
    expect(cfg.userId).toBe("alice");
    expect(cfg.learningSpaceId).toBe("space-123");
    expect(cfg.skillsDir).toBe("/custom/skills");
    expect(cfg.autoCapture).toBe(false);
    expect(cfg.autoLearn).toBe(false);
    expect(cfg.minTurnsForLearn).toBe(6);
  });

  test("fills defaults for optional fields", () => {
    const cfg = configSchema.parse({ apiKey: "sk-ac-x" });
    expect(cfg.autoCapture).toBe(true);
    expect(cfg.autoLearn).toBe(true);
    expect(cfg.minTurnsForLearn).toBe(4);
    expect(cfg.learningSpaceId).toBeUndefined();
    expect(cfg.skillsDir).toContain(".openclaw");
    expect(cfg.skillsDir).toContain("skills");
  });

  test("throws on missing apiKey", () => {
    expect(() => configSchema.parse({ userId: "bob" })).toThrow(
      "apiKey is required",
    );
  });

  test("throws on empty apiKey", () => {
    expect(() => configSchema.parse({ apiKey: "" })).toThrow(
      "apiKey is required",
    );
  });

  test("throws on non-object input", () => {
    expect(() => configSchema.parse(null)).toThrow("config required");
    expect(() => configSchema.parse("string")).toThrow("config required");
    expect(() => configSchema.parse(42)).toThrow("config required");
  });

  test("throws on unknown keys", () => {
    expect(() =>
      configSchema.parse({ apiKey: "sk-ac-x", badKey: true }),
    ).toThrow("unknown keys: badKey");
  });

  test("throws on removed legacy keys", () => {
    expect(() =>
      configSchema.parse({ apiKey: "sk-ac-x", autoRecall: true }),
    ).toThrow("unknown keys: autoRecall");
    expect(() =>
      configSchema.parse({ apiKey: "sk-ac-x", maxSkillFiles: 5 }),
    ).toThrow("unknown keys: maxSkillFiles");
    expect(() =>
      configSchema.parse({ apiKey: "sk-ac-x", maxSkillFileTokens: 2000 }),
    ).toThrow("unknown keys: maxSkillFileTokens");
    expect(() =>
      configSchema.parse({ apiKey: "sk-ac-x", maxTaskSummaryTokens: 1500 }),
    ).toThrow("unknown keys: maxTaskSummaryTokens");
    expect(() =>
      configSchema.parse({ apiKey: "sk-ac-x", recallSessionCount: 3 }),
    ).toThrow("unknown keys: recallSessionCount");
  });

  test("resolves env var in apiKey", () => {
    process.env.MY_SECRET = "resolved-key";
    const cfg = configSchema.parse({ apiKey: "${MY_SECRET}" });
    expect(cfg.apiKey).toBe("resolved-key");
  });

  test("resolves env var in baseUrl", () => {
    process.env.BASE = "http://custom:9000";
    const cfg = configSchema.parse({
      apiKey: "sk-ac-x",
      baseUrl: "${BASE}",
    });
    expect(cfg.baseUrl).toBe("http://custom:9000");
  });

  test("throws on apiKey that resolves to whitespace only", () => {
    process.env.WHITESPACE_KEY = "   ";
    expect(() => configSchema.parse({ apiKey: "${WHITESPACE_KEY}" })).toThrow(
      "apiKey resolved to an empty string",
    );
  });

  test("throws on apiKey that resolves to empty string", () => {
    process.env.EMPTY_KEY = "";
    // resolveEnvVars treats empty env var as unset, so this throws "not set"
    expect(() => configSchema.parse({ apiKey: "${EMPTY_KEY}" })).toThrow();
  });
});

// ============================================================================
// sanitizeSkillName
// ============================================================================

describe("sanitizeSkillName", () => {
  test("lowercases and replaces spaces with hyphens", () => {
    expect(sanitizeSkillName("My Cool Skill")).toBe("my-cool-skill");
  });

  test("preserves underscores and hyphens", () => {
    expect(sanitizeSkillName("skill_v2-beta")).toBe("skill_v2-beta");
  });

  test("trims whitespace", () => {
    expect(sanitizeSkillName("  spaces  ")).toBe("spaces");
  });

  test("collapses consecutive special characters into single hyphen", () => {
    expect(sanitizeSkillName("hello...world")).toBe("hello-world");
  });

  test("strips leading and trailing hyphens after sanitization", () => {
    expect(sanitizeSkillName("--valid--")).toBe("valid");
  });

  test("throws on all-special-characters name", () => {
    expect(() => sanitizeSkillName("@#$")).toThrow("Cannot sanitize skill name");
  });

  test("throws on empty string", () => {
    expect(() => sanitizeSkillName("")).toThrow("Cannot sanitize skill name");
  });

  test("throws on whitespace-only string", () => {
    expect(() => sanitizeSkillName("   ")).toThrow("Cannot sanitize skill name");
  });

  test("throws on hyphens-only string (stripped by trailing cleanup)", () => {
    expect(() => sanitizeSkillName("---")).toThrow("Cannot sanitize skill name");
  });

  test("handles non-ascii unicode by replacing with hyphens", () => {
    expect(sanitizeSkillName("\u2603\u2764-test")).toBe("test");
  });

  test("handles mixed non-ascii and latin", () => {
    expect(sanitizeSkillName("abc \u2603 xyz")).toBe("abc-xyz");
  });
});

// ============================================================================
// AcontextBridge — sync, download, path traversal
// ============================================================================

describe("AcontextBridge", () => {
  let tmpDir: string;
  let dataDir: string;
  let skillsDir: string;
  let mockLogger: BridgeLogger;
  let loggedWarnings: string[];

  const baseCfg: AcontextConfig = {
    apiKey: "sk-ac-test",
    baseUrl: "http://localhost:3000",
    userId: "testuser",
    skillsDir: "",
    autoCapture: true,
    autoLearn: true,
    minTurnsForLearn: 4,
  };

  function createMockClient(overrides?: {
    listSkills?: () => Promise<any[]>;
    getFile?: (opts: any) => Promise<any>;
  }) {
    return {
      sessions: {
        list: jest.fn<any>().mockResolvedValue({ items: [], has_more: false }),
        create: jest.fn<any>().mockResolvedValue({ id: "mock-session" }),
        storeMessage: jest.fn<any>().mockResolvedValue({}),
        flush: jest.fn<any>().mockResolvedValue({ status: 0, errmsg: "" }),
        messagesObservingStatus: jest.fn<any>().mockResolvedValue({ observed: 0, in_process: 0, pending: 0 }),
        getSessionSummary: jest.fn<any>().mockResolvedValue(""),
      },
      learningSpaces: {
        list: jest.fn<any>().mockResolvedValue({ items: [{ id: "space-1" }], has_more: false }),
        create: jest.fn<any>().mockResolvedValue({ id: "space-1" }),
        listSkills: overrides?.listSkills
          ? jest.fn<any>().mockImplementation(overrides.listSkills)
          : jest.fn<any>().mockResolvedValue([]),
        learn: jest.fn<any>().mockResolvedValue({ id: "learn-1" }),
      },
      skills: {
        getFile: overrides?.getFile
          ? jest.fn<any>().mockImplementation(overrides.getFile)
          : jest.fn<any>().mockResolvedValue({ content: { type: "text", raw: "# Skill content" }, url: null }),
      },
      artifacts: {
        grepArtifacts: jest.fn<any>().mockResolvedValue([]),
      },
    };
  }

  function createBridge(mockClient: ReturnType<typeof createMockClient>): AcontextBridge {
    const cfg = { ...baseCfg, skillsDir };
    const bridge = new AcontextBridge(cfg, dataDir, skillsDir, mockLogger);
    (bridge as any).client = mockClient;
    (bridge as any).initPromise = Promise.resolve();
    (bridge as any).learningSpaceId = "space-1";
    return bridge;
  }

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-"));
    dataDir = path.join(tmpDir, "data");
    skillsDir = path.join(tmpDir, "skills");
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
    loggedWarnings = [];
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn((...args: unknown[]) => { loggedWarnings.push(String(args[0])); }),
    };
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("syncSkillsToLocal", () => {
    test("downloads new skills and writes to skillsDir", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "My Skill", description: "desc",
          disk_id: "d1", file_index: [{ path: "SKILL.md", mime: "text/markdown" }],
          updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);

      const skills = await bridge.syncSkillsToLocal();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("My Skill");

      const content = await fs.readFile(path.join(skillsDir, "my-skill", "SKILL.md"), "utf-8");
      expect(content).toBe("# Skill content");
    });

    test("skips unchanged skills (incremental sync)", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "cached-skill", description: "desc",
          disk_id: "d1", file_index: [{ path: "SKILL.md", mime: "text/markdown" }],
          updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);

      await bridge.syncSkillsToLocal();
      expect(mockClient.skills.getFile).toHaveBeenCalledTimes(1);

      mockClient.skills.getFile.mockClear();
      await bridge.syncSkillsToLocal();
      expect(mockClient.skills.getFile).toHaveBeenCalledTimes(0);
    });

    test("re-downloads skills when updatedAt changes", async () => {
      let updatedAt = "2026-01-01T00:00:00Z";
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "evolving-skill", description: "desc",
          disk_id: "d1", file_index: [{ path: "SKILL.md", mime: "text/markdown" }],
          updated_at: updatedAt,
        }],
      });
      const bridge = createBridge(mockClient);

      await bridge.syncSkillsToLocal();
      expect(mockClient.skills.getFile).toHaveBeenCalledTimes(1);

      mockClient.skills.getFile.mockClear();
      updatedAt = "2026-02-01T00:00:00Z";
      (bridge as any).skillsMetadata = null;
      (bridge as any).skillsSynced = false;
      await bridge.syncSkillsToLocal();
      expect(mockClient.skills.getFile).toHaveBeenCalledTimes(1);
    });

    test("removes deleted skills from disk", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "will-delete", description: "desc",
          disk_id: "d1", file_index: [{ path: "SKILL.md", mime: "text/markdown" }],
          updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);
      await bridge.syncSkillsToLocal();

      const skillPath = path.join(skillsDir, "will-delete", "SKILL.md");
      await expect(fs.access(skillPath)).resolves.toBeUndefined();

      // Now remote returns empty — skill deleted server-side
      mockClient.learningSpaces.listSkills.mockResolvedValue([]);
      (bridge as any).skillsMetadata = null;
      (bridge as any).skillsSynced = false;
      await bridge.syncSkillsToLocal();

      await expect(fs.access(skillPath)).rejects.toThrow();
    });

    test("handles skill rename (removes old dir, creates new dir)", async () => {
      let skillName = "old-name";
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: skillName, description: "desc",
          disk_id: "d1", file_index: [{ path: "SKILL.md", mime: "text/markdown" }],
          updated_at: skillName === "old-name" ? "2026-01-01T00:00:00Z" : "2026-02-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);
      await bridge.syncSkillsToLocal();

      await expect(fs.access(path.join(skillsDir, "old-name", "SKILL.md"))).resolves.toBeUndefined();

      // Rename
      skillName = "new-name";
      (bridge as any).skillsMetadata = null;
      (bridge as any).skillsSynced = false;
      await bridge.syncSkillsToLocal();

      await expect(fs.access(path.join(skillsDir, "new-name", "SKILL.md"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(skillsDir, "old-name"))).rejects.toThrow();
    });

    test("cleans stale files when skill content updates in-place", async () => {
      let fileIndex = [
        { path: "guide.md", mime: "text/markdown" },
        { path: "faq.md", mime: "text/markdown" },
      ];
      let updatedAt = "2026-01-01T00:00:00Z";
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "my-skill", description: "desc",
          disk_id: "d1", file_index: fileIndex, updated_at: updatedAt,
        }],
      });
      const bridge = createBridge(mockClient);
      await bridge.syncSkillsToLocal();

      await expect(fs.access(path.join(skillsDir, "my-skill", "guide.md"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(skillsDir, "my-skill", "faq.md"))).resolves.toBeUndefined();

      // v2: faq.md removed
      fileIndex = [{ path: "guide.md", mime: "text/markdown" }];
      updatedAt = "2026-02-01T00:00:00Z";
      (bridge as any).skillsMetadata = null;
      (bridge as any).skillsSynced = false;
      await bridge.syncSkillsToLocal();

      await expect(fs.access(path.join(skillsDir, "my-skill", "guide.md"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(skillsDir, "my-skill", "faq.md"))).rejects.toThrow();
    });
  });

  describe("downloadSkillFiles — path traversal", () => {
    test("rejects path traversal attempts", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "evil-skill", description: "desc",
          disk_id: "d1",
          file_index: [{ path: "../../etc/passwd.md", mime: "text/markdown" }],
          updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);
      await bridge.syncSkillsToLocal();

      expect(mockClient.skills.getFile).not.toHaveBeenCalled();
      expect(loggedWarnings.some((w) => w.includes("path traversal"))).toBe(true);
    });

    test("accepts normal nested paths", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "good-skill", description: "desc",
          disk_id: "d1",
          file_index: [{ path: "docs/guide.md", mime: "text/markdown" }],
          updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);
      await bridge.syncSkillsToLocal();

      expect(mockClient.skills.getFile).toHaveBeenCalledTimes(1);
      const content = await fs.readFile(path.join(skillsDir, "good-skill", "docs", "guide.md"), "utf-8");
      expect(content).toBe("# Skill content");
    });
  });

  describe("listSkills — manifest caching", () => {
    test("returns cached skills without re-syncing", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "cached", description: "desc",
          disk_id: "d1", file_index: [], updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);

      await bridge.syncSkillsToLocal();
      expect(mockClient.learningSpaces.listSkills).toHaveBeenCalledTimes(1);

      const skills = await bridge.listSkills();
      expect(skills).toHaveLength(1);
      expect(mockClient.learningSpaces.listSkills).toHaveBeenCalledTimes(1);
    });

    test("re-syncs after invalidateSkillCaches + stale manifest", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "cached", description: "desc",
          disk_id: "d1", file_index: [], updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);

      await bridge.syncSkillsToLocal();
      bridge.invalidateSkillCaches();

      // Manually make manifest stale by setting syncedAt to past
      const manifestPath = path.join(dataDir, ".manifest.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
      manifest.syncedAt = Date.now() - 60 * 60 * 1000;
      await fs.writeFile(manifestPath, JSON.stringify(manifest), "utf-8");

      await bridge.listSkills();
      expect(mockClient.learningSpaces.listSkills).toHaveBeenCalledTimes(2);
    });
  });

  describe("syncSkillsToLocal — concurrent deduplication", () => {
    test("deduplicates concurrent sync calls into one API request", async () => {
      let resolveListSkills!: (value: any[]) => void;
      const listSkillsPromise = new Promise<any[]>((resolve) => {
        resolveListSkills = resolve;
      });
      const mockClient = createMockClient({
        listSkills: () => listSkillsPromise,
      });
      const bridge = createBridge(mockClient);

      const p1 = bridge.syncSkillsToLocal();
      const p2 = bridge.syncSkillsToLocal();
      const p3 = bridge.syncSkillsToLocal();

      resolveListSkills([{
        id: "s1", name: "skill-a", description: "desc",
        disk_id: "d1", file_index: [], updated_at: "2026-01-01T00:00:00Z",
      }]);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(mockClient.learningSpaces.listSkills).toHaveBeenCalledTimes(1);
      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
      expect(r1).toHaveLength(1);
    });

    test("allows a new sync after the previous one completes", async () => {
      const mockClient = createMockClient({
        listSkills: async () => [{
          id: "s1", name: "skill-a", description: "desc",
          disk_id: "d1", file_index: [], updated_at: "2026-01-01T00:00:00Z",
        }],
      });
      const bridge = createBridge(mockClient);

      await bridge.syncSkillsToLocal();
      expect(mockClient.learningSpaces.listSkills).toHaveBeenCalledTimes(1);

      (bridge as any).skillsMetadata = null;
      (bridge as any).skillsSynced = false;
      await bridge.syncSkillsToLocal();
      expect(mockClient.learningSpaces.listSkills).toHaveBeenCalledTimes(2);
    });
  });

  describe("computeMessageHash", () => {
    test("produces stable hash for same index+content", () => {
      const h1 = AcontextBridge.computeMessageHash(0, { role: "user", content: "hello" });
      const h2 = AcontextBridge.computeMessageHash(0, { role: "user", content: "hello" });
      expect(h1).toBe(h2);
    });

    test("produces different hash for different index but same content", () => {
      const h1 = AcontextBridge.computeMessageHash(0, { role: "user", content: "hello" });
      const h2 = AcontextBridge.computeMessageHash(1, { role: "user", content: "hello" });
      expect(h1).not.toBe(h2);
    });

    test("hash format is index:hex16", () => {
      const h = AcontextBridge.computeMessageHash(5, { role: "user", content: "test" });
      expect(h).toMatch(/^5:[a-f0-9]{16}$/);
    });
  });

  describe("storeMessages — dedup", () => {
    test("skips messages whose hash already exists in sent map", async () => {
      const mockClient = createMockClient();
      let msgCounter = 0;
      mockClient.sessions.storeMessage.mockImplementation(async () => {
        msgCounter++;
        return { id: `msg-${msgCounter}` };
      });
      const bridge = createBridge(mockClient);

      const blobs = [
        { role: "user", content: "msg1" },
        { role: "assistant", content: "msg2" },
      ];

      // First call stores both
      const stored1 = await bridge.storeMessages("sess-1", blobs, 0);
      expect(stored1).toBe(2);
      expect(mockClient.sessions.storeMessage).toHaveBeenCalledTimes(2);

      // Second call with same startIndex — both skipped
      mockClient.sessions.storeMessage.mockClear();
      const stored2 = await bridge.storeMessages("sess-1", blobs, 0);
      expect(stored2).toBe(0);
      expect(mockClient.sessions.storeMessage).not.toHaveBeenCalled();
    });

    test("only sends new messages when some are duplicates", async () => {
      const mockClient = createMockClient();
      let msgCounter = 0;
      mockClient.sessions.storeMessage.mockImplementation(async () => {
        msgCounter++;
        return { id: `msg-${msgCounter}` };
      });
      const bridge = createBridge(mockClient);

      // Store first two
      await bridge.storeMessages("sess-1", [
        { role: "user", content: "msg1" },
        { role: "assistant", content: "msg2" },
      ], 0);

      // Now send 3 messages starting at index 0 — first 2 should be skipped
      mockClient.sessions.storeMessage.mockClear();
      const stored = await bridge.storeMessages("sess-1", [
        { role: "user", content: "msg1" },
        { role: "assistant", content: "msg2" },
        { role: "user", content: "msg3" },
      ], 0);
      expect(stored).toBe(1);
      expect(mockClient.sessions.storeMessage).toHaveBeenCalledTimes(1);
    });

    test("persists sent messages to disk after successful store", async () => {
      const mockClient = createMockClient();
      mockClient.sessions.storeMessage.mockResolvedValue({ id: "msg-1" });
      const bridge = createBridge(mockClient);

      await bridge.storeMessages("sess-1", [{ role: "user", content: "hi" }], 0);

      const raw = await fs.readFile(path.join(dataDir, ".sent-messages.json"), "utf-8");
      const data = JSON.parse(raw);
      expect(data["sess-1"]).toBeDefined();
      expect(Object.keys(data["sess-1"])).toHaveLength(1);
    });

    test("new bridge instance loads sent messages from disk and deduplicates", async () => {
      const mockClient = createMockClient();
      let msgCounter = 0;
      mockClient.sessions.storeMessage.mockImplementation(async () => {
        msgCounter++;
        return { id: `msg-${msgCounter}` };
      });

      // First bridge stores messages
      const bridge1 = createBridge(mockClient);
      await bridge1.storeMessages("sess-1", [
        { role: "user", content: "hello" },
      ], 0);

      // Second bridge — fresh instance, should load from disk
      mockClient.sessions.storeMessage.mockClear();
      const bridge2 = createBridge(mockClient);
      const stored = await bridge2.storeMessages("sess-1", [
        { role: "user", content: "hello" },
        { role: "assistant", content: "world" },
      ], 0);

      // Only the second message should be sent
      expect(stored).toBe(1);
      expect(mockClient.sessions.storeMessage).toHaveBeenCalledTimes(1);
    });

    test("cursor reset + sent messages → duplicates skipped, only new sent", async () => {
      const mockClient = createMockClient();
      let msgCounter = 0;
      mockClient.sessions.storeMessage.mockImplementation(async () => {
        msgCounter++;
        return { id: `msg-${msgCounter}` };
      });
      const bridge = createBridge(mockClient);

      // Simulate initial capture of 2 messages at index 0,1
      await bridge.storeMessages("sess-1", [
        { role: "user", content: "q1" },
        { role: "assistant", content: "a1" },
      ], 0);

      // Simulate cursor reset (compaction) — re-send all 3 messages from index 0
      mockClient.sessions.storeMessage.mockClear();
      const stored = await bridge.storeMessages("sess-1", [
        { role: "user", content: "q1" },
        { role: "assistant", content: "a1" },
        { role: "user", content: "q2" },
      ], 0);

      // Only q2 (index 2) should be new
      expect(stored).toBe(1);
      expect(mockClient.sessions.storeMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("storeMessages — partial failure", () => {
    test("returns count of successfully stored messages when one fails mid-batch", async () => {
      const mockClient = createMockClient();
      let callCount = 0;
      mockClient.sessions.storeMessage.mockImplementation(async () => {
        callCount++;
        if (callCount === 3) throw new Error("network error");
        return { id: `msg-${callCount}` };
      });
      const bridge = createBridge(mockClient);

      const blobs = [
        { role: "user", content: "msg1" },
        { role: "assistant", content: "msg2" },
        { role: "user", content: "msg3" },
        { role: "assistant", content: "msg4" },
      ];

      const stored = await bridge.storeMessages("sess-1", blobs, 0);
      expect(stored).toBe(2);
      expect(mockClient.sessions.storeMessage).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("storeMessage failed at index 2"),
      );
    });

    test("returns 0 when the first message fails", async () => {
      const mockClient = createMockClient();
      mockClient.sessions.storeMessage.mockRejectedValue(new Error("fail"));
      const bridge = createBridge(mockClient);

      const stored = await bridge.storeMessages("sess-1", [{ role: "user", content: "msg1" }]);
      expect(stored).toBe(0);
    });

    test("returns full count when all messages succeed", async () => {
      const mockClient = createMockClient();
      mockClient.sessions.storeMessage.mockResolvedValue({ id: "msg-1" });
      const bridge = createBridge(mockClient);

      const blobs = [
        { role: "user", content: "msg1" },
        { role: "assistant", content: "msg2" },
      ];
      const stored = await bridge.storeMessages("sess-1", blobs);
      expect(stored).toBe(2);
    });
  });

  describe("clearSessionMapping", () => {
    test("clears cached session so ensureSession creates a new one", async () => {
      const mockClient = createMockClient();
      mockClient.sessions.create
        .mockResolvedValueOnce({ id: "session-old" })
        .mockResolvedValueOnce({ id: "session-new" });
      const bridge = createBridge(mockClient);

      const first = await bridge.ensureSession("key-1");
      expect(first).toBe("session-old");

      bridge.clearSessionMapping("key-1");

      const second = await bridge.ensureSession("key-1");
      expect(second).toBe("session-new");
      expect(mockClient.sessions.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("learnFromSession", () => {
    test("returns learned status with ID on success and persists to disk", async () => {
      const mockClient = createMockClient();
      const bridge = createBridge(mockClient);

      const result = await bridge.learnFromSession("sess-1");

      expect(result).toEqual({ status: "learned", id: "learn-1" });
      expect(mockClient.learningSpaces.learn).toHaveBeenCalledWith({
        spaceId: "space-1",
        sessionId: "sess-1",
      });

      const raw = await fs.readFile(path.join(dataDir, ".learned-sessions.json"), "utf-8");
      expect(JSON.parse(raw)).toContain("sess-1");
    });

    test("returns skipped for already-learned session (in-memory)", async () => {
      const mockClient = createMockClient();
      const bridge = createBridge(mockClient);

      await bridge.learnFromSession("sess-1");
      mockClient.learningSpaces.learn.mockClear();

      const result = await bridge.learnFromSession("sess-1");

      expect(result).toEqual({ status: "skipped" });
      expect(mockClient.learningSpaces.learn).not.toHaveBeenCalled();
    });

    test("returns skipped for session persisted by a previous bridge instance", async () => {
      const mockClient = createMockClient();
      const bridge1 = createBridge(mockClient);
      await bridge1.learnFromSession("sess-1");

      mockClient.learningSpaces.learn.mockClear();
      const bridge2 = createBridge(mockClient);
      const result = await bridge2.learnFromSession("sess-1");

      expect(result).toEqual({ status: "skipped" });
      expect(mockClient.learningSpaces.learn).not.toHaveBeenCalled();
    });

    test("returns skipped on 'already learned' API error and persists", async () => {
      const mockClient = createMockClient();
      mockClient.learningSpaces.learn.mockRejectedValue(
        new Error("APIError: session already learned by another space"),
      );
      const bridge = createBridge(mockClient);

      const result = await bridge.learnFromSession("sess-2");

      expect(result).toEqual({ status: "skipped" });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("already learned"),
      );
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("sess-2"),
      );

      const raw = await fs.readFile(path.join(dataDir, ".learned-sessions.json"), "utf-8");
      expect(JSON.parse(raw)).toContain("sess-2");

      mockClient.learningSpaces.learn.mockClear();
      const secondResult = await bridge.learnFromSession("sess-2");
      expect(secondResult).toEqual({ status: "skipped" });
      expect(mockClient.learningSpaces.learn).not.toHaveBeenCalled();
    });

    test("returns error status for other errors without persisting", async () => {
      const mockClient = createMockClient();
      mockClient.learningSpaces.learn.mockRejectedValue(
        new Error("network timeout"),
      );
      const bridge = createBridge(mockClient);

      const result = await bridge.learnFromSession("sess-3");

      expect(result).toEqual({ status: "error" });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("sess-3"),
      );

      const fileExists = await fs.access(path.join(dataDir, ".learned-sessions.json")).then(() => true, () => false);
      expect(fileExists).toBe(false);
    });
  });
});

// ============================================================================
// Plugin Registration (mock-based)
// ============================================================================

describe("plugin registration", () => {
  function createMockApi(pluginConfig: unknown) {
    const hooks: Record<string, Function[]> = {};
    const tools: Array<{ name: string; execute: Function }> = [];
    const cliHandlers: Function[] = [];
    let service: { id: string; start: Function; stop: Function } | null = null;

    const api = {
      pluginConfig,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      resolvePath: (p: string) => p,
      registerTool: jest.fn((toolDef: any, _opts?: any) => {
        tools.push({ name: toolDef.name, execute: toolDef.execute });
      }),
      registerCli: jest.fn((handler: Function) => {
        cliHandlers.push(handler);
      }),
      registerService: jest.fn((svc: any) => {
        service = svc;
      }),
      on: jest.fn((event: string, handler: Function) => {
        if (!hooks[event]) hooks[event] = [];
        hooks[event].push(handler);
      }),
    };

    return { api, hooks, tools, cliHandlers, getService: () => service };
  }

  test("registers all tools, hooks, CLI, and service", async () => {
    const { default: plugin } = await import("../index");

    const { api, hooks, tools, cliHandlers, getService } = createMockApi({
      apiKey: "sk-ac-test",
    });

    plugin.register(api as any);

    // 3 tools registered (acontext_read_skill removed)
    expect(api.registerTool).toHaveBeenCalledTimes(3);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("acontext_search_skills");
    expect(toolNames).toContain("acontext_session_history");
    expect(toolNames).toContain("acontext_learn_now");
    expect(toolNames).not.toContain("acontext_read_skill");

    // before_agent_start for skill sync check + agent_end for capture
    // + before_compaction and before_reset for pre-clear learning
    expect(hooks["before_agent_start"]).toHaveLength(1);
    expect(hooks["agent_end"]).toHaveLength(1);
    expect(hooks["before_compaction"]).toHaveLength(1);
    expect(hooks["before_reset"]).toHaveLength(1);

    // CLI registered
    expect(api.registerCli).toHaveBeenCalledTimes(1);

    // Service registered
    expect(api.registerService).toHaveBeenCalledTimes(1);
    expect(getService()!.id).toBe("acontext");
  });

  test("skips capture hook when autoCapture=false", async () => {
    const { default: plugin } = await import("../index");

    const { api, hooks } = createMockApi({
      apiKey: "sk-ac-test",
      autoCapture: false,
    });

    plugin.register(api as any);

    // before_agent_start always registered (for skill sync)
    expect(hooks["before_agent_start"]).toHaveLength(1);
    // agent_end, before_compaction, before_reset not registered when autoCapture=false
    expect(hooks["agent_end"]).toBeUndefined();
    expect(hooks["before_compaction"]).toBeUndefined();
    expect(hooks["before_reset"]).toBeUndefined();
  });

  test("logs on registration", async () => {
    const { default: plugin } = await import("../index");

    const { api } = createMockApi({
      apiKey: "sk-ac-test",
      userId: "testuser",
    });

    plugin.register(api as any);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("testuser"),
    );
  });
});

// ============================================================================
// Before-Agent-Start Hook Behavior (skill sync check)
// ============================================================================

describe("before_agent_start hook", () => {
  function createMockApi(pluginConfig: unknown) {
    const hooks: Record<string, Function[]> = {};
    const api = {
      pluginConfig,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      resolvePath: (p: string) => p,
      registerTool: jest.fn(),
      registerCli: jest.fn(),
      registerService: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        if (!hooks[event]) hooks[event] = [];
        hooks[event].push(handler);
      }),
    };
    return { api, hooks };
  }

  test("does not return prependContext (no injection)", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const hook = hooks["before_agent_start"][0];
    const result = await hook({ prompt: "Tell me about my previous work" }, {});
    // Should not return prependContext — skills are loaded natively by OpenClaw
    expect(result).toBeUndefined();
  });

  test("handles API errors gracefully without blocking", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const hook = hooks["before_agent_start"][0];
    const result = await hook(
      { prompt: "Tell me about my previous work" },
      {},
    );
    expect(result === undefined || typeof result === "object").toBe(true);
  });
});

// ============================================================================
// Auto-Capture Hook Behavior
// ============================================================================

describe("auto-capture hook", () => {
  function createMockApi(pluginConfig: unknown) {
    const hooks: Record<string, Function[]> = {};
    const api = {
      pluginConfig,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      resolvePath: (p: string) => p,
      registerTool: jest.fn(),
      registerCli: jest.fn(),
      registerService: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        if (!hooks[event]) hooks[event] = [];
        hooks[event].push(handler);
      }),
    };
    return { api, hooks };
  }

  test("skips capture when event.success is false", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const captureHook = hooks["agent_end"][0];
    const result = await captureHook(
      { success: false, messages: [{ role: "user", content: "hello" }] },
      {},
    );
    expect(result).toBeUndefined();
  });

  test("skips capture when messages is empty", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const captureHook = hooks["agent_end"][0];
    const result = await captureHook({ success: true, messages: [] }, {});
    expect(result).toBeUndefined();
  });

  test("skips capture when messages is missing", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const captureHook = hooks["agent_end"][0];
    const result = await captureHook({ success: true }, {});
    expect(result).toBeUndefined();
  });

  test("stores messages without stripping context", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const captureHook = hooks["agent_end"][0];
    const result = await captureHook(
      {
        success: true,
        messages: [
          { role: "user", content: "Actual question" },
          { role: "assistant", content: "Here is my answer" },
        ],
      },
      { sessionKey: "test-session-key" },
    );
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Plugin Metadata
// ============================================================================

describe("plugin metadata", () => {
  test("exports correct id, kind, and version", async () => {
    const { default: plugin } = await import("../index");
    expect(plugin.id).toBe("acontext");
    expect(plugin.kind).toBe("memory");
    expect(plugin.name).toBe("Acontext Skill Memory");
    expect(plugin.version).toBe("0.1.5");
  });
});

// ============================================================================
// Before-Compaction / Before-Reset Hook Behavior
// ============================================================================

describe("before_compaction and before_reset hooks", () => {
  function createMockApi(pluginConfig: unknown) {
    const hooks: Record<string, Function[]> = {};
    const api = {
      pluginConfig,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      resolvePath: (p: string) => p,
      registerTool: jest.fn(),
      registerCli: jest.fn(),
      registerService: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        if (!hooks[event]) hooks[event] = [];
        hooks[event].push(handler);
      }),
    };
    return { api, hooks };
  }

  test("before_compaction hook is registered when autoCapture=true", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    expect(hooks["before_compaction"]).toHaveLength(1);
  });

  test("before_reset hook is registered when autoCapture=true", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    expect(hooks["before_reset"]).toHaveLength(1);
  });

  test("before_compaction does not throw when no active session", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const hook = hooks["before_compaction"][0];
    const result = await hook({ messageCount: 10 }, {});
    expect(result).toBeUndefined();
  });

  test("before_reset does not throw when no active session", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const hook = hooks["before_reset"][0];
    const result = await hook({}, {});
    expect(result).toBeUndefined();
  });

  test("hooks not registered when autoCapture=false", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({
      apiKey: "sk-ac-test",
      autoCapture: false,
    });

    plugin.register(api as any);

    expect(hooks["before_compaction"]).toBeUndefined();
    expect(hooks["before_reset"]).toBeUndefined();
  });
});

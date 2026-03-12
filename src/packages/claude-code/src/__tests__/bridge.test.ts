import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { AcontextBridge, sanitizeSkillName } from "../bridge";
import type { AcontextConfig } from "../config";

// -- sanitizeSkillName --------------------------------------------------------

describe("sanitizeSkillName", () => {
  it("lowercases and replaces special chars with hyphens", () => {
    expect(sanitizeSkillName("My Cool Skill!")).toBe("my-cool-skill");
  });

  it("preserves hyphens and underscores", () => {
    expect(sanitizeSkillName("my-skill_v2")).toBe("my-skill_v2");
  });

  it("strips leading and trailing hyphens", () => {
    expect(sanitizeSkillName("--test--")).toBe("test");
  });

  it("collapses consecutive special chars into single hyphen", () => {
    expect(sanitizeSkillName("a   b...c")).toBe("a-b-c");
  });

  it("throws on empty result", () => {
    expect(() => sanitizeSkillName("!!!")).toThrow(
      "Cannot sanitize skill name",
    );
  });

  it("throws on whitespace-only", () => {
    expect(() => sanitizeSkillName("   ")).toThrow(
      "Cannot sanitize skill name",
    );
  });

  it("handles unicode by replacing with hyphens", () => {
    expect(sanitizeSkillName("日本語skill")).toBe("skill");
  });
});

// -- computeMessageHash -------------------------------------------------------

describe("AcontextBridge.computeMessageHash", () => {
  it("returns index:hash format", () => {
    const hash = AcontextBridge.computeMessageHash(0, {
      role: "user",
      content: "hello",
    });
    expect(hash).toMatch(/^0:[a-f0-9]{16}$/);
  });

  it("different indices produce different hashes", () => {
    const blob = { role: "user", content: "hello" };
    const h1 = AcontextBridge.computeMessageHash(0, blob);
    const h2 = AcontextBridge.computeMessageHash(1, blob);
    expect(h1).not.toBe(h2);
  });

  it("different content produces different hashes", () => {
    const h1 = AcontextBridge.computeMessageHash(0, {
      role: "user",
      content: "hello",
    });
    const h2 = AcontextBridge.computeMessageHash(0, {
      role: "user",
      content: "world",
    });
    expect(h1).not.toBe(h2);
  });

  it("same input produces same hash (deterministic)", () => {
    const blob = { role: "assistant", content: "test" };
    const h1 = AcontextBridge.computeMessageHash(5, blob);
    const h2 = AcontextBridge.computeMessageHash(5, blob);
    expect(h1).toBe(h2);
  });
});

// -- Session state persistence ------------------------------------------------

function makeConfig(overrides?: Partial<AcontextConfig>): AcontextConfig {
  return {
    apiKey: "test-key",
    baseUrl: "https://api.test",
    userId: "test-user",
    skillsDir: "/tmp/skills",
    autoCapture: true,
    autoLearn: true,
    minTurnsForLearn: 4,
    ...overrides,
  };
}

describe("AcontextBridge session state", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads session state", async () => {
    const bridge = new AcontextBridge(makeConfig(), tmpDir);

    // Manually set state via public setters
    // We need to use ensureSession but that requires a client.
    // Instead, test saveSessionState/loadSessionState indirectly
    // by writing state file and loading it.
    const stateFile = path.join(tmpDir, ".session-state.json");
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      stateFile,
      JSON.stringify({
        sessionId: "ses-123",
        turnCount: 5,
        lastProcessedIndex: 10,
        timestamp: Date.now(),
      }),
    );

    const loaded = await bridge.loadSessionState();
    expect(loaded).toBe(true);
    expect(bridge.getSessionId()).toBe("ses-123");
    expect(bridge.getTurnCount()).toBe(5);
    expect(bridge.getLastProcessedIndex()).toBe(10);
  });

  it("rejects state older than 24 hours", async () => {
    const bridge = new AcontextBridge(makeConfig(), tmpDir);
    const stateFile = path.join(tmpDir, ".session-state.json");
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      stateFile,
      JSON.stringify({
        sessionId: "old-ses",
        turnCount: 1,
        lastProcessedIndex: 0,
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );

    const loaded = await bridge.loadSessionState();
    expect(loaded).toBe(false);
    expect(bridge.getSessionId()).toBeNull();
  });

  it("returns false when state file does not exist", async () => {
    const bridge = new AcontextBridge(makeConfig(), tmpDir);
    const loaded = await bridge.loadSessionState();
    expect(loaded).toBe(false);
  });

  it("clearSessionState removes the file", async () => {
    const bridge = new AcontextBridge(makeConfig(), tmpDir);
    const stateFile = path.join(tmpDir, ".session-state.json");
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(stateFile, "{}");

    await bridge.clearSessionState();
    await expect(fs.stat(stateFile)).rejects.toThrow();
  });

  it("clearSessionState does not throw if file missing", async () => {
    const bridge = new AcontextBridge(makeConfig(), tmpDir);
    await expect(bridge.clearSessionState()).resolves.toBeUndefined();
  });

  it("handles missing lastProcessedIndex in state (defaults to 0)", async () => {
    const bridge = new AcontextBridge(makeConfig(), tmpDir);
    const stateFile = path.join(tmpDir, ".session-state.json");
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      stateFile,
      JSON.stringify({
        sessionId: "ses-456",
        turnCount: 2,
        // no lastProcessedIndex
        timestamp: Date.now(),
      }),
    );

    await bridge.loadSessionState();
    expect(bridge.getLastProcessedIndex()).toBe(0);
  });
});

// -- Turn count ---------------------------------------------------------------

describe("AcontextBridge turn count", () => {
  it("starts at 0", () => {
    const bridge = new AcontextBridge(makeConfig(), "/tmp/test");
    expect(bridge.getTurnCount()).toBe(0);
  });

  it("increments", () => {
    const bridge = new AcontextBridge(makeConfig(), "/tmp/test");
    bridge.incrementTurnCount();
    bridge.incrementTurnCount();
    expect(bridge.getTurnCount()).toBe(2);
  });

  it("resets to 0", () => {
    const bridge = new AcontextBridge(makeConfig(), "/tmp/test");
    bridge.incrementTurnCount();
    bridge.incrementTurnCount();
    bridge.resetTurnCount();
    expect(bridge.getTurnCount()).toBe(0);
  });
});

// -- Last processed index -----------------------------------------------------

describe("AcontextBridge lastProcessedIndex", () => {
  it("starts at 0", () => {
    const bridge = new AcontextBridge(makeConfig(), "/tmp/test");
    expect(bridge.getLastProcessedIndex()).toBe(0);
  });

  it("can be set and retrieved", () => {
    const bridge = new AcontextBridge(makeConfig(), "/tmp/test");
    bridge.setLastProcessedIndex(42);
    expect(bridge.getLastProcessedIndex()).toBe(42);
  });
});

// -- Skill cache invalidation -------------------------------------------------

describe("AcontextBridge.invalidateSkillCaches", () => {
  it("does not throw", () => {
    const bridge = new AcontextBridge(makeConfig(), "/tmp/test");
    expect(() => bridge.invalidateSkillCaches()).not.toThrow();
  });
});

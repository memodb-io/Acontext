import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "node:path";
import * as os from "node:os";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, ACONTEXT_API_KEY: "test-key-123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when ACONTEXT_API_KEY is missing", async () => {
    delete process.env.ACONTEXT_API_KEY;
    const { loadConfig } = await import("../config");
    expect(() => loadConfig()).toThrow("ACONTEXT_API_KEY is required");
  });

  it("trims whitespace from API key", async () => {
    process.env.ACONTEXT_API_KEY = "  my-key  ";
    const { loadConfig } = await import("../config");
    expect(loadConfig().apiKey).toBe("my-key");
  });

  it("uses default baseUrl when env is not set", async () => {
    delete process.env.ACONTEXT_BASE_URL;
    const { loadConfig } = await import("../config");
    expect(loadConfig().baseUrl).toBe("https://api.acontext.app/api/v1");
  });

  it("uses custom baseUrl from env", async () => {
    process.env.ACONTEXT_BASE_URL = "https://custom.api/v1";
    const { loadConfig } = await import("../config");
    expect(loadConfig().baseUrl).toBe("https://custom.api/v1");
  });

  it("uses default userId when env is not set", async () => {
    delete process.env.ACONTEXT_USER_ID;
    const { loadConfig } = await import("../config");
    expect(loadConfig().userId).toBe("default");
  });

  it("reads learningSpaceId from env", async () => {
    process.env.ACONTEXT_LEARNING_SPACE_ID = "space-123";
    const { loadConfig } = await import("../config");
    expect(loadConfig().learningSpaceId).toBe("space-123");
  });

  it("defaults learningSpaceId to undefined", async () => {
    delete process.env.ACONTEXT_LEARNING_SPACE_ID;
    const { loadConfig } = await import("../config");
    expect(loadConfig().learningSpaceId).toBeUndefined();
  });

  it("uses default skillsDir under homedir", async () => {
    delete process.env.ACONTEXT_SKILLS_DIR;
    const { loadConfig } = await import("../config");
    expect(loadConfig().skillsDir).toBe(
      path.join(os.homedir(), ".claude", "skills"),
    );
  });

  it("uses custom skillsDir from env", async () => {
    process.env.ACONTEXT_SKILLS_DIR = "/custom/skills";
    const { loadConfig } = await import("../config");
    expect(loadConfig().skillsDir).toBe("/custom/skills");
  });

  describe("autoCapture", () => {
    it("defaults to true", async () => {
      delete process.env.ACONTEXT_AUTO_CAPTURE;
      const { loadConfig } = await import("../config");
      expect(loadConfig().autoCapture).toBe(true);
    });

    it("is false only when explicitly set to 'false'", async () => {
      process.env.ACONTEXT_AUTO_CAPTURE = "false";
      const { loadConfig } = await import("../config");
      expect(loadConfig().autoCapture).toBe(false);
    });

    it("is true for any other string value", async () => {
      process.env.ACONTEXT_AUTO_CAPTURE = "0";
      const { loadConfig } = await import("../config");
      expect(loadConfig().autoCapture).toBe(true);
    });
  });

  describe("autoLearn", () => {
    it("defaults to true", async () => {
      delete process.env.ACONTEXT_AUTO_LEARN;
      const { loadConfig } = await import("../config");
      expect(loadConfig().autoLearn).toBe(true);
    });

    it("is false only when explicitly set to 'false'", async () => {
      process.env.ACONTEXT_AUTO_LEARN = "false";
      const { loadConfig } = await import("../config");
      expect(loadConfig().autoLearn).toBe(false);
    });
  });

  describe("minTurnsForLearn", () => {
    it("defaults to 4", async () => {
      delete process.env.ACONTEXT_MIN_TURNS_FOR_LEARN;
      delete process.env.ACONTEXT_MIN_TURNS;
      const { loadConfig } = await import("../config");
      expect(loadConfig().minTurnsForLearn).toBe(4);
    });

    it("reads from ACONTEXT_MIN_TURNS_FOR_LEARN", async () => {
      process.env.ACONTEXT_MIN_TURNS_FOR_LEARN = "7";
      const { loadConfig } = await import("../config");
      expect(loadConfig().minTurnsForLearn).toBe(7);
    });

    it("falls back to legacy ACONTEXT_MIN_TURNS", async () => {
      delete process.env.ACONTEXT_MIN_TURNS_FOR_LEARN;
      process.env.ACONTEXT_MIN_TURNS = "5";
      const { loadConfig } = await import("../config");
      expect(loadConfig().minTurnsForLearn).toBe(5);
    });

    it("ACONTEXT_MIN_TURNS_FOR_LEARN takes priority over legacy", async () => {
      process.env.ACONTEXT_MIN_TURNS_FOR_LEARN = "10";
      process.env.ACONTEXT_MIN_TURNS = "5";
      const { loadConfig } = await import("../config");
      expect(loadConfig().minTurnsForLearn).toBe(10);
    });

    it("returns default 4 for non-numeric value", async () => {
      process.env.ACONTEXT_MIN_TURNS_FOR_LEARN = "abc";
      const { loadConfig } = await import("../config");
      expect(loadConfig().minTurnsForLearn).toBe(4);
    });

    it("clamps value 0 to default 4", async () => {
      process.env.ACONTEXT_MIN_TURNS_FOR_LEARN = "0";
      const { loadConfig } = await import("../config");
      expect(loadConfig().minTurnsForLearn).toBe(4);
    });

    it("clamps negative value to default 4", async () => {
      process.env.ACONTEXT_MIN_TURNS_FOR_LEARN = "-3";
      const { loadConfig } = await import("../config");
      expect(loadConfig().minTurnsForLearn).toBe(4);
    });
  });
});

describe("resolveDataDir", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses CLAUDE_PLUGIN_ROOT/data when set", async () => {
    process.env.CLAUDE_PLUGIN_ROOT = "/some/plugin/root";
    const { resolveDataDir } = await import("../config");
    expect(resolveDataDir()).toBe("/some/plugin/root/data");
  });

  it("falls back to os.homedir()/.acontext-claude-code", async () => {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    const { resolveDataDir } = await import("../config");
    expect(resolveDataDir()).toBe(
      path.join(os.homedir(), ".acontext-claude-code"),
    );
  });

  it("does not use /tmp as fallback", async () => {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    delete process.env.HOME;
    const { resolveDataDir } = await import("../config");
    expect(resolveDataDir()).not.toContain("/tmp");
  });
});

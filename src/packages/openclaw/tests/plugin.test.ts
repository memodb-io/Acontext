/**
 * Unit tests for @acontext/openclaw plugin.
 *
 * Tests config parsing, helper functions, AcontextBridge logic,
 * and plugin hook behavior using mocks.
 */

import { jest, describe, test, expect, beforeEach, afterAll } from "@jest/globals";
import {
  resolveEnvVars,
  assertAllowedKeys,
  configSchema,
  truncateByTokenEstimate,
  stripInjectedContext,
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
      autoCapture: false,
      autoRecall: false,
      autoLearn: false,
      maxSkillFiles: 5,
      maxSkillFileTokens: 1000,
      maxTaskSummaryTokens: 800,
      recallSessionCount: 2,
      minTurnsForLearn: 6,
    });
    expect(cfg.apiKey).toBe("sk-ac-literal");
    expect(cfg.baseUrl).toBe("http://localhost:3000");
    expect(cfg.userId).toBe("alice");
    expect(cfg.learningSpaceId).toBe("space-123");
    expect(cfg.autoCapture).toBe(false);
    expect(cfg.autoRecall).toBe(false);
    expect(cfg.autoLearn).toBe(false);
    expect(cfg.maxSkillFiles).toBe(5);
    expect(cfg.maxSkillFileTokens).toBe(1000);
    expect(cfg.maxTaskSummaryTokens).toBe(800);
    expect(cfg.recallSessionCount).toBe(2);
    expect(cfg.minTurnsForLearn).toBe(6);
  });

  test("fills defaults for optional fields", () => {
    const cfg = configSchema.parse({ apiKey: "sk-ac-x" });
    expect(cfg.autoCapture).toBe(true);
    expect(cfg.autoRecall).toBe(true);
    expect(cfg.autoLearn).toBe(true);
    expect(cfg.maxSkillFiles).toBe(10);
    expect(cfg.maxSkillFileTokens).toBe(2000);
    expect(cfg.maxTaskSummaryTokens).toBe(1500);
    expect(cfg.recallSessionCount).toBe(3);
    expect(cfg.minTurnsForLearn).toBe(4);
    expect(cfg.learningSpaceId).toBeUndefined();
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
});

// ============================================================================
// Helper Functions
// ============================================================================

describe("truncateByTokenEstimate", () => {
  test("returns short text unchanged", () => {
    expect(truncateByTokenEstimate("hello", 100)).toBe("hello");
  });

  test("truncates long text", () => {
    const long = "a".repeat(10000);
    const result = truncateByTokenEstimate(long, 10); // 10 tokens * 3 = 30 chars
    expect(result.length).toBeLessThan(100);
    expect(result).toContain("... (truncated)");
  });

  test("handles empty string", () => {
    expect(truncateByTokenEstimate("", 100)).toBe("");
  });

  test("boundary: exactly at limit", () => {
    const text = "a".repeat(300); // 100 tokens * 3 = 300 chars
    const result = truncateByTokenEstimate(text, 100);
    expect(result).toBe(text); // exactly at limit, no truncation
  });

  test("boundary: one char over limit", () => {
    const text = "a".repeat(301);
    const result = truncateByTokenEstimate(text, 100);
    expect(result).toContain("... (truncated)");
  });
});

describe("stripInjectedContext", () => {
  test("strips acontext-context block", () => {
    const input =
      "<acontext-context>\nSkill content here\n</acontext-context>\n\nActual user message";
    expect(stripInjectedContext(input)).toBe("Actual user message");
  });

  test("strips multiline context block", () => {
    const input = `<acontext-context>
<acontext-skills>
### coding-prefs: prefs.md
Use TypeScript
</acontext-skills>

<acontext-tasks>
<session id="abc">
<task id="1" description="Build API">
</task>
</session>
</acontext-tasks>
</acontext-context>

Tell me about React`;
    expect(stripInjectedContext(input)).toBe("Tell me about React");
  });

  test("returns unchanged text if no context block", () => {
    const input = "Just a normal message";
    expect(stripInjectedContext(input)).toBe("Just a normal message");
  });

  test("returns empty string if only context", () => {
    const input = "<acontext-context>stuff</acontext-context>";
    expect(stripInjectedContext(input)).toBe("");
  });

  test("handles multiple context blocks", () => {
    const input =
      "<acontext-context>a</acontext-context> middle <acontext-context>b</acontext-context> end";
    expect(stripInjectedContext(input)).toBe("middle end");
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
    // Dynamic import to get the plugin with mocked deps
    const { default: plugin } = await import("../index");

    const { api, hooks, tools, cliHandlers, getService } = createMockApi({
      apiKey: "sk-ac-test",
    });

    plugin.register(api as any);

    // 4 tools registered
    expect(api.registerTool).toHaveBeenCalledTimes(4);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("acontext_search_skills");
    expect(toolNames).toContain("acontext_read_skill");
    expect(toolNames).toContain("acontext_session_history");
    expect(toolNames).toContain("acontext_learn_now");

    // Hooks registered (autoRecall + autoCapture both default true)
    expect(hooks["before_agent_start"]).toHaveLength(1);
    expect(hooks["agent_end"]).toHaveLength(1);

    // CLI registered
    expect(api.registerCli).toHaveBeenCalledTimes(1);

    // Service registered
    expect(api.registerService).toHaveBeenCalledTimes(1);
    expect(getService()!.id).toBe("acontext");
  });

  test("skips recall hook when autoRecall=false", async () => {
    const { default: plugin } = await import("../index");

    const { api, hooks } = createMockApi({
      apiKey: "sk-ac-test",
      autoRecall: false,
    });

    plugin.register(api as any);

    expect(hooks["before_agent_start"]).toBeUndefined();
    // capture hook still present
    expect(hooks["agent_end"]).toHaveLength(1);
  });

  test("skips capture hook when autoCapture=false", async () => {
    const { default: plugin } = await import("../index");

    const { api, hooks } = createMockApi({
      apiKey: "sk-ac-test",
      autoCapture: false,
    });

    plugin.register(api as any);

    // recall hook still present
    expect(hooks["before_agent_start"]).toHaveLength(1);
    expect(hooks["agent_end"]).toBeUndefined();
  });

  test("skips both hooks when both disabled", async () => {
    const { default: plugin } = await import("../index");

    const { api, hooks } = createMockApi({
      apiKey: "sk-ac-test",
      autoRecall: false,
      autoCapture: false,
    });

    plugin.register(api as any);

    expect(hooks["before_agent_start"]).toBeUndefined();
    expect(hooks["agent_end"]).toBeUndefined();
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
// Auto-Recall Hook Behavior
// ============================================================================

describe("auto-recall hook", () => {
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

  test("skips recall when prompt is too short", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const recallHook = hooks["before_agent_start"][0];
    const result = await recallHook({ prompt: "hi" }, {});
    expect(result).toBeUndefined();
  });

  test("skips recall when prompt is empty", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const recallHook = hooks["before_agent_start"][0];
    const result = await recallHook({ prompt: "" }, {});
    expect(result).toBeUndefined();
  });

  test("handles API errors gracefully without blocking", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const recallHook = hooks["before_agent_start"][0];
    // This will fail internally because mock SDK throws, but should not throw
    const result = await recallHook(
      { prompt: "Tell me about my previous work" },
      {},
    );
    // Should either return undefined (no context) or an object — never throw
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

  test("processes messages with injected context stripped", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const captureHook = hooks["agent_end"][0];
    // Capture with messages containing injected context
    const result = await captureHook(
      {
        success: true,
        messages: [
          {
            role: "user",
            content:
              "<acontext-context>\nskill data\n</acontext-context>\n\nActual question",
          },
          { role: "assistant", content: "Here is my answer" },
        ],
      },
      { sessionKey: "test-session-key" },
    );
    // Should not throw regardless of outcome
    expect(result).toBeUndefined();
  });

  test("skips messages with only injected context (no real content)", async () => {
    const { default: plugin } = await import("../index");
    const { api, hooks } = createMockApi({ apiKey: "sk-ac-test" });

    plugin.register(api as any);

    const captureHook = hooks["agent_end"][0];
    const result = await captureHook(
      {
        success: true,
        messages: [
          { role: "user", content: "<acontext-context>only context</acontext-context>" },
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
  test("exports correct id and kind", async () => {
    const { default: plugin } = await import("../index");
    expect(plugin.id).toBe("acontext");
    expect(plugin.kind).toBe("memory");
    expect(plugin.name).toBe("Acontext Skill Memory");
  });
});

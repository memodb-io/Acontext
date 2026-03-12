import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseStdinJson,
  readTranscriptMessages,
  mergeConsecutiveMessages,
} from "../transcript";

// -- parseStdinJson -----------------------------------------------------------

describe("parseStdinJson", () => {
  it("parses valid JSON", () => {
    const result = parseStdinJson('{"transcript_path": "/tmp/t.jsonl"}');
    expect(result).toEqual({ transcript_path: "/tmp/t.jsonl" });
  });

  it("returns null for empty string", () => {
    expect(parseStdinJson("")).toBeNull();
    expect(parseStdinJson("   ")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const warn = vi.fn();
    expect(parseStdinJson("{bad", warn)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("returns null without calling warn when input is empty", () => {
    const warn = vi.fn();
    parseStdinJson("", warn);
    expect(warn).not.toHaveBeenCalled();
  });
});

// -- readTranscriptMessages ---------------------------------------------------

describe("readTranscriptMessages", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "transcript-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeTranscript(lines: unknown[]): Promise<string> {
    const filePath = path.join(tmpDir, "transcript.jsonl");
    await fs.writeFile(
      filePath,
      lines.map((l) => JSON.stringify(l)).join("\n"),
    );
    return filePath;
  }

  it("extracts messages with role and content", async () => {
    const filePath = await writeTranscript([
      { message: { role: "user", content: "hello" } },
      { message: { role: "assistant", content: "hi" } },
    ]);
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
  });

  it("extracts messages with array content", async () => {
    const filePath = await writeTranscript([
      {
        message: {
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
        },
      },
    ]);
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toEqual([{ type: "text", text: "hello" }]);
  });

  it("skips entries without message field", async () => {
    const filePath = await writeTranscript([
      { type: "system", data: "init" },
      { message: { role: "user", content: "hello" } },
    ]);
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toHaveLength(1);
  });

  it("skips messages with empty array content", async () => {
    const filePath = await writeTranscript([
      { message: { role: "assistant", content: [] } },
    ]);
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toHaveLength(0);
  });

  it("skips messages with empty string content", async () => {
    const filePath = await writeTranscript([
      { message: { role: "assistant", content: "" } },
    ]);
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toHaveLength(0);
  });

  it("skips malformed JSON lines gracefully", async () => {
    const filePath = path.join(tmpDir, "bad.jsonl");
    await fs.writeFile(
      filePath,
      [
        '{"message":{"role":"user","content":"a"}}',
        "{bad json",
        '{"message":{"role":"assistant","content":"b"}}',
      ].join("\n"),
    );
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toHaveLength(2);
  });

  it("skips blank lines", async () => {
    const filePath = path.join(tmpDir, "blanks.jsonl");
    await fs.writeFile(
      filePath,
      [
        '{"message":{"role":"user","content":"a"}}',
        "",
        "   ",
        '{"message":{"role":"assistant","content":"b"}}',
      ].join("\n"),
    );
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toHaveLength(2);
  });

  it("returns empty array for non-existent file (ENOENT)", async () => {
    const msgs = await readTranscriptMessages("/nonexistent/path.jsonl");
    expect(msgs).toEqual([]);
  });

  it("skips entries without role", async () => {
    const filePath = await writeTranscript([
      { message: { content: "no role" } },
    ]);
    const msgs = await readTranscriptMessages(filePath);
    expect(msgs).toHaveLength(0);
  });
});

// -- mergeConsecutiveMessages -------------------------------------------------

describe("mergeConsecutiveMessages", () => {
  it("returns empty for empty input", () => {
    const { messages, rawCounts } = mergeConsecutiveMessages([]);
    expect(messages).toEqual([]);
    expect(rawCounts).toEqual([]);
  });

  it("passes through alternating roles unchanged", () => {
    const raw = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "bye" },
    ];
    const { messages, rawCounts } = mergeConsecutiveMessages(raw);
    expect(messages).toHaveLength(3);
    expect(rawCounts).toEqual([1, 1, 1]);
  });

  it("merges consecutive same-role entries", () => {
    const raw = [
      { role: "assistant", content: [{ type: "thinking", text: "..." }] },
      { role: "assistant", content: [{ type: "text", text: "answer" }] },
      { role: "assistant", content: [{ type: "tool_use", name: "grep" }] },
    ];
    const { messages, rawCounts } = mergeConsecutiveMessages(raw);
    expect(messages).toHaveLength(1);
    expect(rawCounts).toEqual([3]);
    const content = messages[0].content as unknown[];
    expect(content).toHaveLength(3);
    expect(content[0]).toEqual({ type: "thinking", text: "..." });
    expect(content[1]).toEqual({ type: "text", text: "answer" });
    expect(content[2]).toEqual({ type: "tool_use", name: "grep" });
  });

  it("wraps string content in text blocks when merging", () => {
    const raw = [
      { role: "user", content: "first" },
      { role: "user", content: "second" },
    ];
    const { messages, rawCounts } = mergeConsecutiveMessages(raw);
    expect(messages).toHaveLength(1);
    expect(rawCounts).toEqual([2]);
    const content = messages[0].content as unknown[];
    expect(content).toEqual([
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ]);
  });

  it("handles mixed merge and non-merge", () => {
    const raw = [
      { role: "user", content: "q" },
      { role: "assistant", content: [{ type: "text", text: "a1" }] },
      { role: "assistant", content: [{ type: "text", text: "a2" }] },
      { role: "user", content: "q2" },
    ];
    const { messages, rawCounts } = mergeConsecutiveMessages(raw);
    expect(messages).toHaveLength(3);
    expect(rawCounts).toEqual([1, 2, 1]);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[2].role).toBe("user");
    expect((messages[1].content as unknown[]).length).toBe(2);
  });

  it("rawCounts sum equals input length", () => {
    const raw = [
      { role: "assistant", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
      { role: "assistant", content: "d" },
      { role: "assistant", content: "e" },
      { role: "assistant", content: "f" },
    ];
    const { rawCounts } = mergeConsecutiveMessages(raw);
    const total = rawCounts.reduce((a, b) => a + b, 0);
    expect(total).toBe(raw.length);
  });
});

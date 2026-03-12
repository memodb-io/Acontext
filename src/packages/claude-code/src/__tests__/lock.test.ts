import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { acquireLock, releaseLock } from "../lock";

describe("acquireLock", () => {
  let tmpDir: string;
  let lockDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lock-test-"));
    lockDir = path.join(tmpDir, "test-lock");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("acquires lock on empty directory", async () => {
    const result = await acquireLock(lockDir);
    expect(result).toBe(true);
    const stat = await fs.stat(lockDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("writes info file with pid and timestamp", async () => {
    await acquireLock(lockDir);
    const raw = await fs.readFile(path.join(lockDir, "info"), "utf-8");
    const info = JSON.parse(raw);
    expect(info.pid).toBe(process.pid);
    expect(typeof info.ts).toBe("number");
    expect(Date.now() - info.ts).toBeLessThan(5000);
  });

  it("returns false when lock is held (non-stale)", async () => {
    await fs.mkdir(lockDir);
    await fs.writeFile(
      path.join(lockDir, "info"),
      JSON.stringify({ pid: process.pid, ts: Date.now() }),
    );
    expect(await acquireLock(lockDir)).toBe(false);
  });

  it("reclaims stale lock and acquires", async () => {
    await fs.mkdir(lockDir);
    await fs.writeFile(
      path.join(lockDir, "info"),
      JSON.stringify({ pid: 99999, ts: Date.now() - 60_000 }),
    );
    expect(await acquireLock(lockDir)).toBe(true);
  });

  it("reclaims lock when info file is missing but dir is stale", async () => {
    await fs.mkdir(lockDir);
    // No info file — falls back to stat mtime check.
    // Manually set mtime to past (touch won't help, use utimes)
    const past = new Date(Date.now() - 60_000);
    await fs.utimes(lockDir, past, past);
    expect(await acquireLock(lockDir)).toBe(true);
  });

  it("terminates without infinite recursion (bounded retries)", async () => {
    await fs.mkdir(lockDir);
    await fs.writeFile(
      path.join(lockDir, "info"),
      JSON.stringify({ pid: process.pid, ts: Date.now() }),
    );
    const start = Date.now();
    const result = await acquireLock(lockDir);
    expect(result).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("propagates non-EEXIST errors", async () => {
    // lockDir's parent doesn't exist → should throw ENOENT, not return false
    const badLock = path.join(tmpDir, "nonexistent", "child", "lock");
    await expect(acquireLock(badLock)).rejects.toThrow();
  });
});

describe("releaseLock", () => {
  let tmpDir: string;
  let lockDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lock-test-"));
    lockDir = path.join(tmpDir, "test-lock");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("removes the lock directory", async () => {
    await acquireLock(lockDir);
    await releaseLock(lockDir);
    await expect(fs.stat(lockDir)).rejects.toThrow();
  });

  it("does not throw if lock does not exist", async () => {
    await expect(releaseLock(lockDir)).resolves.toBeUndefined();
  });
});

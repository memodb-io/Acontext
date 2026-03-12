/**
 * Cross-process file lock using mkdir (atomic on POSIX).
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const LOCK_STALE_MS = 30_000;

export async function acquireLock(lockDir: string): Promise<boolean> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await fs.mkdir(lockDir, { recursive: false });
      await fs
        .writeFile(
          path.join(lockDir, "info"),
          JSON.stringify({ pid: process.pid, ts: Date.now() }),
        )
        .catch(() => {});
      return true;
    } catch (err: any) {
      if (err?.code !== "EEXIST") throw err;
      // Check if stale and attempt to reclaim
      let reclaimed = false;
      try {
        const raw = await fs.readFile(path.join(lockDir, "info"), "utf-8");
        const { ts } = JSON.parse(raw) as { pid: number; ts: number };
        if (Date.now() - ts > LOCK_STALE_MS) {
          await fs.rm(lockDir, { recursive: true, force: true });
          reclaimed = true;
        }
      } catch {
        try {
          const stat = await fs.stat(lockDir);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            await fs.rm(lockDir, { recursive: true, force: true });
            reclaimed = true;
          }
        } catch {
          // Lock dir vanished between checks — retry to acquire
          reclaimed = true;
        }
      }
      if (reclaimed) continue;
      return false;
    }
  }
  return false;
}

export async function releaseLock(lockDir: string): Promise<void> {
  await fs.rm(lockDir, { recursive: true, force: true });
}

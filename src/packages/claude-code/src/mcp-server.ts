/**
 * MCP Server for the Acontext Claude Code plugin.
 *
 * Provides 5 tools:
 * - acontext_search_skills: Search through learned skill files
 * - acontext_get_skill: Read a specific skill file's content
 * - acontext_session_history: Get recent session summaries
 * - acontext_stats: Show memory statistics and configuration
 * - acontext_learn_now: Trigger learning from current session
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AcontextBridge } from "./bridge";
import { type AcontextConfig, loadConfig, resolveDataDir } from "./config";

let config: AcontextConfig;
try {
  config = loadConfig();
} catch (err) {
  console.error(`[info] acontext: config unavailable (${String(err)}), MCP server exiting`);
  process.exit(0);
}
const dataDir = resolveDataDir();
const bridge = new AcontextBridge(config, dataDir, {
  info: (msg) => console.error(`[info] ${msg}`),
  warn: (msg) => console.error(`[warn] ${msg}`),
});

const server = new McpServer({
  name: "acontext",
  version: "0.1.0",
});

// -- Tools ------------------------------------------------------------------

server.tool(
  "acontext_search_skills",
  "Search through learned skill files by keyword. Use when you need to find specific knowledge from past sessions.",
  {
    query: z.string().describe("Search keyword or regex pattern"),
    limit: z.number().optional().describe("Max results (default: 10)"),
  },
  async ({ query, limit = 10 }) => {
    try {
      const skills = await bridge.listSkills();
      if (skills.length === 0) {
        return { content: [{ type: "text", text: "No skills learned yet." }] };
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
        };
      }

      const text = allMatches
        .slice(0, limit)
        .map((m, i) => `${i + 1}. [${m.skillName}] ${m.path}/${m.filename}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${allMatches.length} matches:\n\n${text}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Skill search failed: ${String(err)}` },
        ],
      };
    }
  },
);

server.tool(
  "acontext_get_skill",
  "Read the content of a specific skill file. Use after searching to read the full skill details.",
  {
    skill_id: z.string().describe("The skill ID"),
    file_path: z
      .string()
      .describe("File path within the skill (e.g. 'skill.md')"),
  },
  async ({ skill_id, file_path }) => {
    try {
      const content = await bridge.getSkillFileContent(skill_id, file_path);
      return {
        content: [{ type: "text", text: content }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to read skill file: ${String(err)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "acontext_session_history",
  "Get task summaries from recent past sessions. Use to recall what was done previously.",
  {
    limit: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .describe("Max sessions to include (default: 3)"),
  },
  async ({ limit }) => {
    try {
      const summaries = await bridge.getRecentSessionSummaries(limit);
      if (!summaries) {
        return {
          content: [
            { type: "text", text: "No session history available." },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Recent session history:\n\n${summaries}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Session history failed: ${String(err)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "acontext_stats",
  "Show Acontext memory statistics — session count, skill count, and configuration.",
  {},
  async () => {
    try {
      const stats = await bridge.getStats();
      const lines = [
        `User: ${config.userId}`,
        `Learning Space: ${stats.learningSpaceId ?? "not created"}`,
        `Sessions: ${stats.sessionCountIsApproximate ? `${stats.sessionCount}+` : stats.sessionCount}`,
        `Skills: ${stats.skillCount}`,
        `Skills directory: ${config.skillsDir}`,
        `Auto-capture: ${config.autoCapture}, Auto-learn: ${config.autoLearn}`,
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Stats failed: ${String(err)}` },
        ],
      };
    }
  },
);

server.tool(
  "acontext_learn_now",
  "Trigger skill learning from the current session immediately. Distills reusable skills from this conversation.",
  {},
  async () => {
    try {
      // Load session state persisted by hook handler
      await bridge.loadSessionState();
      const sessionId = bridge.getSessionId();
      if (!sessionId) {
        return {
          content: [
            { type: "text", text: "No active session to learn from." },
          ],
        };
      }

      await bridge.flush(sessionId);
      const result = await bridge.learnFromSession(sessionId);

      if (result.status === "skipped") {
        return {
          content: [
            { type: "text", text: "This session has already been learned." },
          ],
        };
      }
      if (result.status === "error") {
        return {
          content: [
            { type: "text", text: "Failed to trigger learning." },
          ],
        };
      }

      // Sync skills to local directory in background
      bridge.syncSkillsToLocal().catch((err) => {
        console.error(
          `[warn] acontext: skill sync after learn_now failed: ${String(err)}`,
        );
      });

      return {
        content: [
          {
            type: "text",
            text: `Learning triggered (id: ${result.id}). Skills will be synced to ${config.skillsDir} once processing completes.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Learn failed: ${String(err)}` },
        ],
      };
    }
  },
);

// -- Start ------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[acontext] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[acontext] Fatal:", err);
  process.exit(1);
});

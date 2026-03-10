"use server";

import {
  AcontextClient,
  type GetSandboxLogsResp,
} from "@/lib/acontext/server";

export async function getSandboxLogs(
  projectId: string,
  limit: number = 20,
  cursor?: string,
  timeDesc: boolean = false
): Promise<GetSandboxLogsResp> {
  try {
    const client = new AcontextClient();
    return await client.getSandboxLogs(projectId, limit, cursor, timeDesc);
  } catch (error) {
    console.error("Failed to fetch sandbox logs:", error);
    throw error;
  }
}

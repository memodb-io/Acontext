"use server";

import { AcontextClient, type Trace } from "@/lib/acontext/server";

export async function fetchTraces(
  projectId: string,
  start: number, // microseconds (required)
  end: number, // microseconds (required)
  limit: number = 100,
  tags?: string // JSON string for Jaeger tag filtering
): Promise<Trace[]> {
  try {
    const client = new AcontextClient();
    return await client.getTraces(projectId, {
      start,
      end,
      limit,
      tags,
    });
  } catch (error) {
    console.error("Failed to fetch traces:", error);
    throw error;
  }
}


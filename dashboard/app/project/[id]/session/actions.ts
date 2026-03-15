"use server";

import {
  AcontextClient,
  type Session,
  type SessionEvent,
  type GetSessionsResp,
  type GetSessionConfigsResp,
  type GetMessagesResp,
  type GetEventsResp,
  type GetTasksResp,
  type MessageRole,
  type Part,
} from "@/lib/acontext/server";

export async function getSessions(
  projectId: string,
  limit: number = 20,
  cursor?: string,
  timeDesc: boolean = false,
  user?: string
): Promise<GetSessionsResp> {
  try {
    const client = new AcontextClient();
    return await client.getSessions(projectId, limit, cursor, timeDesc, user);
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    throw error;
  }
}

export async function createSession(
  projectId: string,
  configs?: Record<string, unknown>,
  user?: string,
  disableTaskTracking?: boolean
): Promise<Session> {
  try {
    const client = new AcontextClient();
    return await client.createSession(projectId, configs, user, disableTaskTracking);
  } catch (error) {
    console.error("Failed to create session:", error);
    throw error;
  }
}

export async function deleteSession(projectId: string, sessionId: string): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.deleteSession(projectId, sessionId);
  } catch (error) {
    console.error("Failed to delete session:", error);
    throw error;
  }
}

export async function getSessionConfigs(
  projectId: string,
  sessionId: string
): Promise<GetSessionConfigsResp> {
  try {
    const client = new AcontextClient();
    return await client.getSessionConfigs(projectId, sessionId);
  } catch (error) {
    console.error("Failed to fetch session configs:", error);
    throw error;
  }
}

export async function updateSessionConfigs(
  projectId: string,
  sessionId: string,
  configs: Record<string, unknown>
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.updateSessionConfigs(projectId, sessionId, configs);
  } catch (error) {
    console.error("Failed to update session configs:", error);
    throw error;
  }
}

export async function getMessages(
  projectId: string,
  sessionId: string,
  limit: number = 20,
  cursor?: string
): Promise<GetMessagesResp> {
  try {
    const client = new AcontextClient();
    return await client.getMessages(projectId, sessionId, limit, cursor);
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    throw error;
  }
}

export async function downloadMessages(
  projectId: string,
  sessionId: string,
  format: "acontext" | "openai" | "anthropic" | "gemini"
): Promise<string> {
  try {
    const client = new AcontextClient();
    const data = await client.downloadMessages(projectId, sessionId, format);
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error("Failed to download messages:", error);
    throw error;
  }
}

export async function sendMessage(
  projectId: string,
  sessionId: string,
  role: MessageRole,
  parts: Part[],
  files?: Record<string, File>
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.sendMessage(projectId, sessionId, role, parts, files);
  } catch (error) {
    console.error("Failed to send message:", error);
    throw error;
  }
}

export async function addEvent(
  projectId: string,
  sessionId: string,
  type: string,
  data: Record<string, unknown>
): Promise<SessionEvent> {
  try {
    const client = new AcontextClient();
    return await client.addEvent(projectId, sessionId, type, data);
  } catch (error) {
    console.error("Failed to add event:", error);
    throw error;
  }
}

export async function getEvents(
  projectId: string,
  sessionId: string,
  limit: number = 50,
  cursor?: string
): Promise<GetEventsResp> {
  try {
    const client = new AcontextClient();
    return await client.getEvents(projectId, sessionId, limit, cursor);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    throw error;
  }
}

export async function getTasks(
  projectId: string,
  sessionId: string,
  limit: number = 20,
  cursor?: string
): Promise<GetTasksResp> {
  try {
    const client = new AcontextClient();
    return await client.getTasks(projectId, sessionId, limit, cursor);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    throw error;
  }
}

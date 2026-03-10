"use server";

import {
  AcontextClient,
  type AgentSkill,
  type GetAgentSkillsResp,
  type GetAgentSkillFileResp,
} from "@/lib/acontext/server";

export async function getAgentSkills(
  projectId: string,
  limit: number = 20,
  cursor?: string,
  timeDesc: boolean = false,
  user?: string
): Promise<GetAgentSkillsResp> {
  try {
    const client = new AcontextClient();
    return await client.getAgentSkills(projectId, limit, cursor, timeDesc, user);
  } catch (error) {
    console.error("Failed to fetch agent skills:", error);
    throw error;
  }
}

export async function getAgentSkill(
  projectId: string,
  skillId: string
): Promise<AgentSkill> {
  try {
    const client = new AcontextClient();
    return await client.getAgentSkill(projectId, skillId);
  } catch (error) {
    console.error("Failed to fetch agent skill:", error);
    throw error;
  }
}

export async function deleteAgentSkill(
  projectId: string,
  skillId: string
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.deleteAgentSkill(projectId, skillId);
  } catch (error) {
    console.error("Failed to delete agent skill:", error);
    throw error;
  }
}

export async function getAgentSkillFile(
  projectId: string,
  skillId: string,
  filePath: string,
  expire: number = 900
): Promise<GetAgentSkillFileResp> {
  try {
    const client = new AcontextClient();
    return await client.getAgentSkillFile(projectId, skillId, filePath, expire);
  } catch (error) {
    console.error("Failed to get agent skill file:", error);
    throw error;
  }
}

export async function createAgentSkill(
  projectId: string,
  file: File,
  user?: string,
  meta?: Record<string, unknown>
): Promise<AgentSkill> {
  try {
    const client = new AcontextClient();
    return await client.createAgentSkill(projectId, file, user, meta);
  } catch (error) {
    console.error("Failed to create agent skill:", error);
    throw error;
  }
}

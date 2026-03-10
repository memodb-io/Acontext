"use server";

import {
  AcontextClient,
  type LearningSpace,
  type GetLearningSpacesResp,
  type LearningSpaceSession,
  type LearningSpaceSkill,
  type AgentSkill,
} from "@/lib/acontext/server";

export async function getLearningSpaces(
  projectId: string,
  limit: number = 20,
  cursor?: string,
  timeDesc: boolean = false,
  user?: string
): Promise<GetLearningSpacesResp> {
  try {
    const client = new AcontextClient();
    return await client.getLearningSpaces(projectId, limit, cursor, timeDesc, user);
  } catch (error) {
    console.error("Failed to fetch learning spaces:", error);
    throw error;
  }
}

export async function getLearningSpace(
  projectId: string,
  spaceId: string
): Promise<LearningSpace> {
  try {
    const client = new AcontextClient();
    return await client.getLearningSpace(projectId, spaceId);
  } catch (error) {
    console.error("Failed to fetch learning space:", error);
    throw error;
  }
}

export async function createLearningSpace(
  projectId: string,
  user?: string,
  meta?: Record<string, unknown>
): Promise<LearningSpace> {
  try {
    const client = new AcontextClient();
    return await client.createLearningSpace(projectId, user, meta);
  } catch (error) {
    console.error("Failed to create learning space:", error);
    throw error;
  }
}

export async function updateLearningSpace(
  projectId: string,
  spaceId: string,
  meta: Record<string, unknown>
): Promise<LearningSpace> {
  try {
    const client = new AcontextClient();
    return await client.updateLearningSpace(projectId, spaceId, meta);
  } catch (error) {
    console.error("Failed to update learning space:", error);
    throw error;
  }
}

export async function deleteLearningSpace(
  projectId: string,
  spaceId: string
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.deleteLearningSpace(projectId, spaceId);
  } catch (error) {
    console.error("Failed to delete learning space:", error);
    throw error;
  }
}

export async function learnFromSession(
  projectId: string,
  spaceId: string,
  sessionId: string
): Promise<LearningSpaceSession> {
  try {
    const client = new AcontextClient();
    return await client.learnFromSession(projectId, spaceId, sessionId);
  } catch (error) {
    console.error("Failed to learn from session:", error);
    throw error;
  }
}

export async function listSpaceSessions(
  projectId: string,
  spaceId: string
): Promise<LearningSpaceSession[]> {
  try {
    const client = new AcontextClient();
    return await client.listSpaceSessions(projectId, spaceId);
  } catch (error) {
    console.error("Failed to list space sessions:", error);
    throw error;
  }
}

export async function listSpaceSkills(
  projectId: string,
  spaceId: string
): Promise<AgentSkill[]> {
  try {
    const client = new AcontextClient();
    return await client.listSpaceSkills(projectId, spaceId);
  } catch (error) {
    console.error("Failed to list space skills:", error);
    throw error;
  }
}

export async function includeSkill(
  projectId: string,
  spaceId: string,
  skillId: string
): Promise<LearningSpaceSkill> {
  try {
    const client = new AcontextClient();
    return await client.includeSkillInSpace(projectId, spaceId, skillId);
  } catch (error) {
    console.error("Failed to include skill:", error);
    throw error;
  }
}

export async function excludeSkill(
  projectId: string,
  spaceId: string,
  skillId: string
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.excludeSkillFromSpace(projectId, spaceId, skillId);
  } catch (error) {
    console.error("Failed to exclude skill:", error);
    throw error;
  }
}

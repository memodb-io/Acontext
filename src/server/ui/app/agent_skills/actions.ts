"use server";

import { ApiResponse } from "@/lib/api-response";
import { API_SERVER_URL, ROOT_API_BEARER_TOKEN, getAuthHeaders, handleResponse, handleError } from "@/lib/api-config";
import { AgentSkill, GetAgentSkillsResp } from "@/types";

export async function getAgentSkills(
  limit: number = 20,
  cursor?: string,
  time_desc: boolean = false
): Promise<ApiResponse<GetAgentSkillsResp>> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_desc: time_desc.toString(),
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/agent_skills?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetAgentSkillsResp>(response);
  } catch (error) {
    return handleError(error, "getAgentSkills");
  }
}

export async function getAgentSkill(
  id: string
): Promise<ApiResponse<AgentSkill>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/agent_skills/${id}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<AgentSkill>(response);
  } catch (error) {
    return handleError(error, "getAgentSkill");
  }
}

export async function createAgentSkill(
  file: File,
  user?: string,
  meta?: string
): Promise<ApiResponse<AgentSkill>> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (user) {
      formData.append("user", user);
    }
    if (meta) {
      formData.append("meta", meta);
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/agent_skills`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer sk-ac-${ROOT_API_BEARER_TOKEN}`,
        },
        body: formData,
      }
    );

    return await handleResponse<AgentSkill>(response);
  } catch (error) {
    return handleError(error, "createAgentSkill");
  }
}

export async function deleteAgentSkill(
  id: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/agent_skills/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteAgentSkill");
  }
}

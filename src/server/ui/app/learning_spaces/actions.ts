"use server";

import { ApiResponse } from "@/lib/api-response";
import {
  API_SERVER_URL,
  getAuthHeaders,
  handleResponse,
  handleError,
} from "@/lib/api-config";
import {
  LearningSpace,
  GetLearningSpacesResp,
  LearningSpaceSession,
  LearningSpaceSkill,
  AgentSkill,
} from "@/types";

export async function getLearningSpaces(
  limit: number = 20,
  cursor?: string,
  user?: string,
  timeDesc?: boolean,
  filterByMeta?: string
): Promise<ApiResponse<GetLearningSpacesResp>> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_desc: (timeDesc ?? false).toString(),
    });
    if (cursor !== undefined) params.append("cursor", cursor);
    if (user !== undefined) params.append("user", user);
    if (filterByMeta !== undefined) params.append("filter_by_meta", filterByMeta);

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetLearningSpacesResp>(response);
  } catch (error) {
    return handleError(error, "getLearningSpaces");
  }
}

export async function getLearningSpace(
  id: string
): Promise<ApiResponse<LearningSpace>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<LearningSpace>(response);
  } catch (error) {
    return handleError(error, "getLearningSpace");
  }
}

export async function createLearningSpace(
  user?: string,
  meta?: Record<string, unknown>
): Promise<ApiResponse<LearningSpace>> {
  try {
    const body: Record<string, unknown> = {};
    if (user !== undefined) body.user = user;
    if (meta !== undefined) body.meta = meta;

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      }
    );

    return await handleResponse<LearningSpace>(response);
  } catch (error) {
    return handleError(error, "createLearningSpace");
  }
}

export async function updateLearningSpace(
  id: string,
  meta: Record<string, unknown>
): Promise<ApiResponse<LearningSpace>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ meta }),
      }
    );

    return await handleResponse<LearningSpace>(response);
  } catch (error) {
    return handleError(error, "updateLearningSpace");
  }
}

export async function deleteLearningSpace(
  id: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteLearningSpace");
  }
}

export async function learnFromSession(
  id: string,
  sessionId: string
): Promise<ApiResponse<LearningSpaceSession>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}/learn`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
      }
    );

    return await handleResponse<LearningSpaceSession>(response);
  } catch (error) {
    return handleError(error, "learnFromSession");
  }
}

export async function listSpaceSkills(
  id: string
): Promise<ApiResponse<AgentSkill[]>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}/skills`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<AgentSkill[]>(response);
  } catch (error) {
    return handleError(error, "listSpaceSkills");
  }
}

export async function includeSkill(
  id: string,
  skillId: string
): Promise<ApiResponse<LearningSpaceSkill>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}/skills`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ skill_id: skillId }),
      }
    );

    return await handleResponse<LearningSpaceSkill>(response);
  } catch (error) {
    return handleError(error, "includeSkill");
  }
}

export async function excludeSkill(
  id: string,
  skillId: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}/skills/${skillId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "excludeSkill");
  }
}

export async function listSpaceSessions(
  id: string
): Promise<ApiResponse<LearningSpaceSession[]>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/learning_spaces/${id}/sessions`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<LearningSpaceSession[]>(response);
  } catch (error) {
    return handleError(error, "listSpaceSessions");
  }
}

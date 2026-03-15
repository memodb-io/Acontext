"use server";

import { ApiResponse } from "@/lib/api-response";
import {
  API_SERVER_URL,
  getAuthHeaders,
  handleResponse,
  handleError,
} from "@/lib/api-config";

export interface ProjectConfig {
  task_success_criteria?: string | null;
  task_failure_criteria?: string | null;
  [key: string]: unknown;
}

export async function getProjectConfigs(): Promise<ApiResponse<ProjectConfig>> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/project/configs`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    return await handleResponse<ProjectConfig>(response);
  } catch (error) {
    return handleError(error, "getProjectConfigs");
  }
}

export async function updateProjectConfigs(
  configs: Partial<ProjectConfig>
): Promise<ApiResponse<ProjectConfig>> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/project/configs`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(configs),
    });
    return await handleResponse<ProjectConfig>(response);
  } catch (error) {
    return handleError(error, "updateProjectConfigs");
  }
}

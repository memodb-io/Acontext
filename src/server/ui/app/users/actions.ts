"use server";

import { ApiResponse } from "@/lib/api-response";
import { API_SERVER_URL, getAuthHeaders, handleResponse, handleError } from "@/lib/api-config";
import { GetUsersResp, UserResources } from "@/types";

export async function getUsers(
  limit: number = 0,
  cursor?: string,
  time_desc: boolean = false
): Promise<ApiResponse<GetUsersResp>> {
  try {
    const params = new URLSearchParams({
      time_desc: time_desc.toString(),
    });
    if (limit > 0) {
      params.append("limit", limit.toString());
    }
    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/user/ls?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetUsersResp>(response);
  } catch (error) {
    return handleError(error, "getUsers");
  }
}

export async function deleteUser(
  identifier: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/user/${encodeURIComponent(identifier)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteUser");
  }
}

export async function getUserResources(
  identifier: string
): Promise<ApiResponse<UserResources>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/user/${encodeURIComponent(identifier)}/resources`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<UserResources>(response);
  } catch (error) {
    return handleError(error, "getUserResources");
  }
}

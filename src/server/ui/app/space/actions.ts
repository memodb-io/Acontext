"use server";

import { ApiResponse } from "@/lib/api-response";
import { API_SERVER_URL, getAuthHeaders, handleResponse, handleError } from "@/lib/api-config";
import {
  Space,
  GetSpacesResp,
  Block,
  MessageRole,
  MessagePartIn,
} from "@/types";

// Space APIs
export async function getSpaces(
  limit: number = 20,
  cursor?: string,
  time_desc: boolean = false
): Promise<ApiResponse<GetSpacesResp>> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_desc: time_desc.toString(),
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetSpacesResp>(response);
  } catch (error) {
    return handleError(error, "getSpaces");
  }
}

export async function createSpace(
  configs?: Record<string, unknown>
): Promise<ApiResponse<Space>> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/space`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ configs: configs || {} }),
    });

    return await handleResponse<Space>(response);
  } catch (error) {
    return handleError(error, "createSpace");
  }
}

export async function deleteSpace(space_id: string): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/space/${space_id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteSpace");
  }
}

export async function getSpaceConfigs(
  space_id: string
): Promise<ApiResponse<Space>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${space_id}/configs`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<Space>(response);
  } catch (error) {
    return handleError(error, "getSpaceConfigs");
  }
}

export async function updateSpaceConfigs(
  space_id: string,
  configs: Record<string, unknown>
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${space_id}/configs`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ configs }),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "updateSpaceConfigs");
  }
}

// Block APIs
export async function listBlocks(
  spaceId: string,
  options?: {
    type?: string;
    parentId?: string;
  }
): Promise<ApiResponse<Block[]>> {
  try {
    const params = new URLSearchParams();
    if (options?.type) params.append("type", options.type);
    if (options?.parentId) params.append("parent_id", options.parentId);

    const queryString = params.toString();
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${spaceId}/block${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<Block[]>(response);
  } catch (error) {
    return handleError(error, "listBlocks");
  }
}

export async function createBlock(
  spaceId: string,
  data: {
    type: string;
    parent_id?: string;
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<ApiResponse<Block>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${spaceId}/block`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );

    return await handleResponse<Block>(response);
  } catch (error) {
    return handleError(error, "createBlock");
  }
}

export async function deleteBlock(
  spaceId: string,
  blockId: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${spaceId}/block/${blockId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteBlock");
  }
}

export async function getBlockProperties(
  spaceId: string,
  blockId: string
): Promise<ApiResponse<Block>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${spaceId}/block/${blockId}/properties`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<Block>(response);
  } catch (error) {
    return handleError(error, "getBlockProperties");
  }
}

export async function updateBlockProperties(
  spaceId: string,
  blockId: string,
  data: {
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${spaceId}/block/${blockId}/properties`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "updateBlockProperties");
  }
}

export async function moveBlock(
  spaceId: string,
  blockId: string,
  data: {
    parent_id?: string | null;
    sort?: number;
  }
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${spaceId}/block/${blockId}/move`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "moveBlock");
  }
}

export async function updateBlockSort(
  spaceId: string,
  blockId: string,
  sort: number
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/space/${spaceId}/block/${blockId}/sort`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ sort }),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "updateBlockSort");
  }
}


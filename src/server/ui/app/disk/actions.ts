"use server";

import { ApiResponse } from "@/lib/api-response";
import { API_SERVER_URL, ROOT_API_BEARER_TOKEN, getAuthHeaders, handleResponse, handleError } from "@/lib/api-config";
import { Disk, ListArtifactsResp, GetArtifactResp, GetDisksResp } from "@/types";

export async function getDisks(
  limit: number = 20,
  cursor?: string,
  time_desc: boolean = false
): Promise<ApiResponse<GetDisksResp>> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_desc: time_desc.toString(),
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/disk?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetDisksResp>(response);
  } catch (error) {
    return handleError(error, "getDisks");
  }
}

export async function getListArtifacts(
  disk_id: string,
  path: string
): Promise<ApiResponse<ListArtifactsResp>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/disk/${disk_id}/artifact/ls?path=${encodeURIComponent(path)}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<ListArtifactsResp>(response);
  } catch (error) {
    return handleError(error, "getListArtifacts");
  }
}

export async function getArtifact(
  disk_id: string,
  file_path: string,
  with_content: boolean = true
): Promise<ApiResponse<GetArtifactResp>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/disk/${disk_id}/artifact?file_path=${encodeURIComponent(file_path)}&with_content=${with_content}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetArtifactResp>(response);
  } catch (error) {
    return handleError(error, "getArtifact");
  }
}

export async function createDisk(): Promise<ApiResponse<Disk>> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/disk`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    return await handleResponse<Disk>(response);
  } catch (error) {
    return handleError(error, "createDisk");
  }
}

export async function deleteDisk(disk_id: string): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/disk/${disk_id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteDisk");
  }
}

export async function uploadArtifact(
  disk_id: string,
  file_path: string,
  file: File,
  meta?: Record<string, string>
): Promise<ApiResponse<null>> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_path", file_path);
    if (meta && Object.keys(meta).length > 0) {
      formData.append("meta", JSON.stringify(meta));
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/disk/${disk_id}/artifact`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer sk-ac-${ROOT_API_BEARER_TOKEN}`,
        },
        body: formData,
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "uploadArtifact");
  }
}

export async function deleteArtifact(
  disk_id: string,
  file_path: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/disk/${disk_id}/artifact?file_path=${encodeURIComponent(file_path)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteArtifact");
  }
}

export async function updateArtifactMeta(
  disk_id: string,
  file_path: string,
  meta: Record<string, unknown>
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/disk/${disk_id}/artifact`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          file_path,
          meta: JSON.stringify(meta),
        }),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "updateArtifactMeta");
  }
}


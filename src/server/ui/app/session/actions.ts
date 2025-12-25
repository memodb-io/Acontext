"use server";

import { ApiResponse } from "@/lib/api-response";
import { API_SERVER_URL, ROOT_API_BEARER_TOKEN, MESSAGE_FORMAT, getAuthHeaders, handleResponse, handleError } from "@/lib/api-config";
import {
  Session,
  GetSessionsResp,
  GetMessagesResp,
  GetTasksResp,
  MessageRole,
  MessagePartIn,
} from "@/types";

// Session APIs
export async function getSessions(
  spaceId?: string,
  notConnected?: boolean,
  limit: number = 20,
  cursor?: string,
  time_desc: boolean = false
): Promise<ApiResponse<GetSessionsResp>> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_desc: time_desc.toString(),
    });
    if (spaceId) {
      params.append("space_id", spaceId);
    }
    if (notConnected !== undefined) {
      params.append("not_connected", notConnected.toString());
    }
    if (cursor) {
      params.append("cursor", cursor);
    }

    const queryString = params.toString();
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/session${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetSessionsResp>(response);
  } catch (error) {
    return handleError(error, "getSessions");
  }
}

export async function createSession(
  space_id?: string,
  configs?: Record<string, unknown>
): Promise<ApiResponse<Session>> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/session`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        space_id: space_id || "",
        configs: configs || {},
      }),
    });

    return await handleResponse<Session>(response);
  } catch (error) {
    return handleError(error, "createSession");
  }
}

export async function deleteSession(
  session_id: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/session/${session_id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "deleteSession");
  }
}

export async function getSessionConfigs(
  session_id: string
): Promise<ApiResponse<Session>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/session/${session_id}/configs`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<Session>(response);
  } catch (error) {
    return handleError(error, "getSessionConfigs");
  }
}

export async function updateSessionConfigs(
  session_id: string,
  configs: Record<string, unknown>
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/session/${session_id}/configs`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ configs }),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "updateSessionConfigs");
  }
}

export async function connectSessionToSpace(
  session_id: string,
  space_id: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/session/${session_id}/connect_to_space`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ space_id }),
      }
    );

    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "connectSessionToSpace");
  }
}

// Message APIs
export async function getMessages(
  session_id: string,
  limit: number = 20,
  cursor?: string,
  with_asset_public_url: boolean = true
): Promise<ApiResponse<GetMessagesResp>> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      with_asset_public_url: with_asset_public_url.toString(),
      format: MESSAGE_FORMAT,
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/session/${session_id}/messages?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetMessagesResp>(response);
  } catch (error) {
    return handleError(error, "getMessages");
  }
}

export async function storeMessage(
  session_id: string,
  role: MessageRole,
  parts: MessagePartIn[],
  files?: Record<string, File>
): Promise<ApiResponse<null>> {
  try {
    const hasFiles = files && Object.keys(files).length > 0;

    if (hasFiles) {
      // Use multipart/form-data
      const formData = new FormData();

      // Add payload field (JSON string)
      // Wrap in blob field as expected by the Go API
      const payload = {
        blob: {
          role,
          parts,
        },
        format: MESSAGE_FORMAT,
      };
      formData.append("payload", JSON.stringify(payload));

      // Add files
      for (const [fieldName, file] of Object.entries(files!)) {
        formData.append(fieldName, file);
      }

      const response = await fetch(
        `${API_SERVER_URL}/api/v1/session/${session_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer sk-ac-${ROOT_API_BEARER_TOKEN}`,
          },
          body: formData,
        }
      );

      return await handleResponse<null>(response);
    } else {
      // Use JSON format
      const body = {
        blob: {
          role,
          parts,
        },
        format: MESSAGE_FORMAT,
      };

      const response = await fetch(
        `${API_SERVER_URL}/api/v1/session/${session_id}/messages`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        }
      );

      return await handleResponse<null>(response);
    }
  } catch (error) {
    return handleError(error, "storeMessage");
  }
}

// Task APIs
export async function getTasks(
  session_id: string,
  limit: number = 20,
  cursor?: string
): Promise<ApiResponse<GetTasksResp>> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/session/${session_id}/task?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse<GetTasksResp>(response);
  } catch (error) {
    return handleError(error, "getTasks");
  }
}


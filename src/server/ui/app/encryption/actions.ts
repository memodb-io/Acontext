"use server";

import { ApiResponse } from "@/lib/api-response";
import {
  API_SERVER_URL,
  getAuthHeaders,
  handleResponse,
  handleError,
} from "@/lib/api-config";

export async function getEncryptionStatus(): Promise<
  ApiResponse<{ encryption_enabled: boolean }>
> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/project/configs`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ encryption_enabled: boolean }>(response);
  } catch (error) {
    return handleError(error, "getEncryptionStatus");
  }
}

export async function encryptProject(
  apiKey: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/project/encrypt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "encryptProject");
  }
}

export async function decryptProject(
  apiKey: string
): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/project/decrypt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    return await handleResponse<null>(response);
  } catch (error) {
    return handleError(error, "decryptProject");
  }
}

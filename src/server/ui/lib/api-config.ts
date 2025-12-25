import { ApiResponse } from "@/lib/api-response";

// API Configuration
export const API_SERVER_URL = process.env.API_SERVER_URL;
export const ROOT_API_BEARER_TOKEN = process.env.ROOT_API_BEARER_TOKEN;
export const MESSAGE_FORMAT = "acontext";

// Jaeger Configuration
export const getJaegerUrl = () => {
  return process.env.JAEGER_INTERNAL_URL || process.env.JAEGER_URL || "http://localhost:16686";
};

// Auth Headers Helper
export const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer sk-ac-${ROOT_API_BEARER_TOKEN}`,
});

// Response Handler
export async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      return {
        code: errorJson.code || 1,
        data: null,
        message: errorJson.message || "Internal Server Error",
      };
    } catch {
      return {
        code: 1,
        data: null,
        message: "Internal Server Error",
      };
    }
  }

  const result = await response.json();
  if (result.code !== 0) {
    return {
      code: result.code,
      data: null,
      message: result.message || "Error",
    };
  }

  return {
    code: 0,
    data: result.data,
    message: result.message || "success",
  };
}

// Error Handler
export function handleError<T = null>(error: unknown, functionName: string): ApiResponse<T> {
  console.error(`${functionName} error:`, error);
  return {
    code: 1,
    data: null as T,
    message: error instanceof Error ? error.message : "Internal Server Error",
  };
}


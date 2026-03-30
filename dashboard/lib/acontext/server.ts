/**
 * Server-side functions for interacting with acontext API
 */

import { createClient } from "@/lib/supabase/server";

import {
  AdminOperations,
  DiskOperations,
  SessionOperations,
  MessageOperations,
  TaskOperations,
  UserOperations,
  AgentSkillsOperations,
  SandboxOperations,
  LearningSpacesOperations,
  ProjectConfigOperations,
} from "./operations";

// Re-export all types for backward compatibility
export * from "./operations";

const ACONTEXT_API_BASE_URL =
  process.env.ACONTEXT_API_BASE_URL ?? "https://admin.acontext.app";

/**
 * Get the project API key prefix from environment.
 * Use this to pass the prefix to client components that need to validate API key format.
 */
export function getProjectApiKeyPrefix(): string {
  return process.env.ACONTEXT_PROJECT_BEARER_TOKEN_PREFIX || "sk-ac-";
}

/**
 * Base Acontext API Client class
 * Contains core infrastructure: authentication, request handling, and utilities
 */
class BaseAcontextClient {
  private baseUrl: string;

  constructor(baseUrl: string = ACONTEXT_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get authentication headers for acontext API requests
   *
   * @param projectId The project ID (required for project bearer token)
   * @returns Object with Authorization and X-Access-Token headers
   */
  private async getAuthHeaders(
    projectId?: string
  ): Promise<Record<string, string>> {
    // Get Supabase access token
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("No Supabase session found. Please log in.");
    }

    const headers: Record<string, string> = {
      "X-Access-Token": session.access_token,
    };

    // Generate project bearer token if projectId is provided
    if (projectId) {
      const apiBearerToken = process.env.ACONTEXT_API_BEARER_TOKEN;
      if (!apiBearerToken) {
        throw new Error(
          "ACONTEXT_API_BEARER_TOKEN environment variable is not set"
        );
      }

      const projectBearerTokenPrefix =
        process.env.ACONTEXT_PROJECT_BEARER_TOKEN_PREFIX || "acontext_";

      // Create token data with project_id
      const tokenData: Record<string, string> = {
        project_id: projectId,
      };

      // Sort keys and create signature
      // Note: Signature is base64(concatenated_kv_pairs + apiBearerToken), NOT HMAC
      // This matches the Go implementation in tokens.go
      const sortedKeys = Object.keys(tokenData).sort();
      const kvPairs = sortedKeys
        .map((key) => `${key}${tokenData[key]}`)
        .join("");
      const signatureInput = kvPairs + apiBearerToken;
      const signature = Buffer.from(signatureInput).toString("base64");

      // Add signature to token data
      tokenData.signature = signature;

      // Encode as base64 JSON
      const tokenJson = JSON.stringify(tokenData);
      const tokenBase64 = Buffer.from(tokenJson).toString("base64");
      const bearerToken = `${projectBearerTokenPrefix}${tokenBase64}`;

      headers.Authorization = `Bearer ${bearerToken}`;
    }

    return headers;
  }

  /**
   * Make an API request with error handling
   * Handles Go backend Response format: { code, data, msg, error }
   */
  async request<T>(
    endpoint: string,
    options: {
      method?: string;
      projectId?: string;
      body?: BodyInit;
      headers?: Record<string, string>;
      useFormData?: boolean;
    } = {}
  ): Promise<T> {
    const {
      method = "GET",
      projectId,
      body,
      headers: additionalHeaders = {},
      useFormData = false,
    } = options;

    const authHeaders = await this.getAuthHeaders(projectId);

    const headers: Record<string, string> = {
      ...authHeaders,
      ...additionalHeaders,
    };

    // Don't set Content-Type for FormData, browser will set it with boundary
    if (!useFormData && body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Only include body if it's provided (GET/HEAD requests shouldn't have body)
    if (body !== undefined) {
      fetchOptions.body = body;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

    // Check if status is 2xx before parsing JSON
    if (response.status < 200 || response.status >= 300) {
      // Read the response body as text first
      const responseText = await response.text();
      console.error(
        `API request failed with status ${response.status}:`,
        responseText
      );
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${responseText}`
      );
    }

    const responseData = await response.json();

    // Handle Go backend Response format: { code, data, msg, error }
    if (
      responseData &&
      typeof responseData === "object" &&
      "code" in responseData
    ) {
      const apiResponse = responseData as {
        code: number;
        data?: T;
        msg?: string;
        error?: string;
      };

      // Check if code indicates success (code = 0 means success)
      if (apiResponse.code !== 0) {
        const errorMsg =
          apiResponse.error ||
          apiResponse.msg ||
          `API request failed with code ${apiResponse.code}`;
        throw new Error(errorMsg);
      }

      // Return the data field if present, otherwise return the whole response
      if (apiResponse.data !== undefined) {
        return apiResponse.data;
      }
      return responseData as T;
    }

    return responseData;
  }

  /**
   * Convert date from YYYY-MM-DD format to M/D format
   */
  formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // If parsing fails, try to parse YYYY-MM-DD format manually
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);
          if (!isNaN(month) && !isNaN(day)) {
            return `${month}/${day}`;
          }
        }
        // If all parsing fails, return original string
        return dateStr;
      }
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateStr;
    }
  }
}

/**
 * Compose multiple mixins into a single class
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function composeMixins<T extends new (...args: any[]) => any>(
  Base: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...mixins: Array<(base: any) => any>
): T {
  return mixins.reduce((acc, mixin) => mixin(acc), Base) as T;
}

/**
 * Acontext API Client class
 * Composes all operation mixins to provide full API functionality
 */
const ComposedAcontextClient = composeMixins(
  BaseAcontextClient,
  AdminOperations,
  DiskOperations,
  SessionOperations,
  MessageOperations,
  TaskOperations,
  UserOperations,
  AgentSkillsOperations,
  SandboxOperations,
  LearningSpacesOperations,
  ProjectConfigOperations
);

// Manually define the complete type by intersecting all mixin return types
type AdminOps = ReturnType<typeof AdminOperations<typeof BaseAcontextClient>>;
type DiskOps = ReturnType<typeof DiskOperations<typeof BaseAcontextClient>>;
type SessionOps = ReturnType<typeof SessionOperations<typeof BaseAcontextClient>>;
type MessageOps = ReturnType<typeof MessageOperations<typeof BaseAcontextClient>>;
type TaskOps = ReturnType<typeof TaskOperations<typeof BaseAcontextClient>>;
type UserOps = ReturnType<typeof UserOperations<typeof BaseAcontextClient>>;
type AgentSkillsOps = ReturnType<typeof AgentSkillsOperations<typeof BaseAcontextClient>>;
type SandboxOps = ReturnType<typeof SandboxOperations<typeof BaseAcontextClient>>;
type LearningSpacesOps = ReturnType<typeof LearningSpacesOperations<typeof BaseAcontextClient>>;
type ProjectConfigOps = ReturnType<typeof ProjectConfigOperations<typeof BaseAcontextClient>>;

// Export the complete type
export type AcontextClient = InstanceType<AdminOps> &
  InstanceType<DiskOps> &
  InstanceType<SessionOps> &
  InstanceType<MessageOps> &
  InstanceType<TaskOps> &
  InstanceType<UserOps> &
  InstanceType<AgentSkillsOps> &
  InstanceType<SandboxOps> &
  InstanceType<LearningSpacesOps> &
  InstanceType<ProjectConfigOps>;

// Export the class with proper type assertion
export const AcontextClient = ComposedAcontextClient as new () => AcontextClient;

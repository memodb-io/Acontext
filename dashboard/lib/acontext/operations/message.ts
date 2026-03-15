/**
 * Message API operations for AcontextClient
 */

import { Constructor, BaseClient } from "./base";

// ==================== Type Definitions ====================

export type MessageRole = "user" | "assistant";
export type PartType = "text" | "thinking" | "redacted_thinking" | "image" | "video" | "audio" | "file" | "data" | "tool-call" | "tool-result";

export interface Asset {
  sha256: string;
  mime: string;
  size_b: number;
}

export interface Part {
  type: PartType;
  text?: string;
  filename?: string;
  asset?: Asset;
  meta?: Record<string, unknown>;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  parts: Part[];
  session_task_process_status: string;
  task_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  project_id: string;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GetMessagesResp {
  items: Message[];
  events?: SessionEvent[];
  next_cursor?: string;
  has_more: boolean;
  public_urls?: Record<string, { url: string; expire_at: string }>;
}

export interface GetEventsResp {
  items: SessionEvent[];
  next_cursor?: string;
  has_more: boolean;
}

// ==================== Message Operations Mixin ====================

export function MessageOperations<T extends Constructor<BaseClient>>(Base: T) {
  return class extends Base {
    async getMessages(
      projectId: string,
      sessionId: string,
      limit: number = 20,
      cursor?: string
    ): Promise<GetMessagesResp> {
      const params = new URLSearchParams({
        limit: limit.toString(),
        with_asset_public_url: "true",
        with_events: "true",
        format: "acontext",
      });
      if (cursor) {
        params.append("cursor", cursor);
      }

      const result = await this.request<{
        items?: Message[];
        messages?: Message[];
        events?: SessionEvent[];
        next_cursor?: string;
        has_more?: boolean;
        public_urls?: Record<string, { url: string; expire_at: string }>;
      }>(`/api/v1/session/${sessionId}/messages?${params.toString()}`, {
        projectId,
      });
      return {
        items: result.items || result.messages || [],
        events: result.events,
        next_cursor: result.next_cursor,
        has_more: result.has_more || false,
        public_urls: result.public_urls || {},
      };
    }

    async downloadMessages(
      projectId: string,
      sessionId: string,
      format: "acontext" | "openai" | "anthropic" | "gemini"
    ): Promise<unknown> {
      let allItems: unknown[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          limit: "100",
          format,
        });
        if (cursor) {
          params.append("cursor", cursor);
        }

        const result = await this.request<{
          items?: unknown[];
          messages?: unknown[];
          next_cursor?: string;
          has_more?: boolean;
        }>(`/api/v1/session/${sessionId}/messages?${params.toString()}`, {
          projectId,
        });

        const items = result.items || result.messages || [];
        allItems = allItems.concat(items);
        cursor = result.next_cursor;
        hasMore = result.has_more || false;
      }

      return allItems;
    }

    async sendMessage(
      projectId: string,
      sessionId: string,
      role: MessageRole,
      parts: Part[],
      files?: Record<string, File>
    ): Promise<void> {
      if (files && Object.keys(files).length > 0) {
        // Use FormData if files are present
        const formData = new FormData();

        // Add payload field (JSON string) with blob wrapper and format as expected by the API
        // Format: { blob: { role, parts }, format: "acontext" }
        formData.append("payload", JSON.stringify({
          blob: {
            role,
            parts
          },
          format: "acontext"
        }));

        // Add files
        for (const [key, file] of Object.entries(files)) {
          formData.append(key, file);
        }

        await this.request(`/api/v1/session/${sessionId}/messages`, {
          method: "POST",
          projectId,
          body: formData,
          useFormData: true,
        });
      } else {
        // Use JSON if no files
        // Wrap in blob field and add format as expected by the API
        // Format: { blob: { role, parts }, format: "acontext" }
        await this.request(`/api/v1/session/${sessionId}/messages`, {
          method: "POST",
          projectId,
          body: JSON.stringify({
            blob: {
              role,
              parts
            },
            format: "acontext"
          }),
        });
      }
    }

    async addEvent(
      projectId: string,
      sessionId: string,
      type: string,
      data: Record<string, unknown>
    ): Promise<SessionEvent> {
      return await this.request<SessionEvent>(
        `/api/v1/session/${sessionId}/events`,
        {
          method: "POST",
          projectId,
          body: JSON.stringify({ type, data }),
        }
      );
    }

    async getEvents(
      projectId: string,
      sessionId: string,
      limit: number = 50,
      cursor?: string
    ): Promise<GetEventsResp> {
      const params = new URLSearchParams({
        limit: limit.toString(),
      });
      if (cursor) {
        params.append("cursor", cursor);
      }

      const result = await this.request<{
        items?: SessionEvent[];
        next_cursor?: string;
        has_more?: boolean;
      }>(`/api/v1/session/${sessionId}/events?${params.toString()}`, {
        projectId,
      });
      return {
        items: result.items || [],
        next_cursor: result.next_cursor,
        has_more: result.has_more || false,
      };
    }
  };
}

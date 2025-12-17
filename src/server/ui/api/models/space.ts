import service, { Res } from "../http";
import { Space, Session, GetMessagesResp, GetTasksResp, GetSpacesResp, GetSessionsResp, Block, MessageRole, PartType } from "@/types";

// Space APIs
export const getSpaces = async (
  limit: number = 20,
  cursor?: string,
  time_desc: boolean = false
): Promise<Res<GetSpacesResp>> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    time_desc: time_desc.toString(),
  });
  if (cursor) {
    params.append("cursor", cursor);
  }
  return await service.get(
    `/api/space?${params.toString()}`
  );
};

export const createSpace = async (
  configs?: Record<string, unknown>
): Promise<Res<Space>> => {
  return await service.post("/api/space", { configs: configs || {} });
};

export const deleteSpace = async (space_id: string): Promise<Res<null>> => {
  return await service.delete(`/api/space/${space_id}`);
};

export const getSpaceConfigs = async (space_id: string): Promise<Res<Space>> => {
  return await service.get(`/api/space/${space_id}/configs`);
};

export const updateSpaceConfigs = async (
  space_id: string,
  configs: Record<string, unknown>
): Promise<Res<null>> => {
  return await service.put(`/api/space/${space_id}/configs`, { configs });
};

// Session APIs
export const getSessions = async (
  spaceId?: string,
  notConnected?: boolean,
  limit: number = 20,
  cursor?: string,
  time_desc: boolean = false
): Promise<Res<GetSessionsResp>> => {
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
  return await service.get(
    `/api/session${queryString ? `?${queryString}` : ""}`
  );
};

export const createSession = async (
  space_id?: string,
  configs?: Record<string, unknown>
): Promise<Res<Session>> => {
  return await service.post("/api/session", {
    space_id: space_id || "",
    configs: configs || {},
  });
};

export const deleteSession = async (session_id: string): Promise<Res<null>> => {
  return await service.delete(`/api/session/${session_id}`);
};

export const getSessionConfigs = async (
  session_id: string
): Promise<Res<Session>> => {
  return await service.get(`/api/session/${session_id}/configs`);
};

export const updateSessionConfigs = async (
  session_id: string,
  configs: Record<string, unknown>
): Promise<Res<null>> => {
  return await service.put(`/api/session/${session_id}/configs`, { configs });
};

export const connectSessionToSpace = async (
  session_id: string,
  space_id: string
): Promise<Res<null>> => {
  return await service.post(`/api/session/${session_id}/connect_to_space`, {
    space_id,
  });
};

// Message APIs
export const getMessages = async (
  session_id: string,
  limit: number = 20,
  cursor?: string,
  with_asset_public_url: boolean = true
): Promise<Res<GetMessagesResp>> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    with_asset_public_url: with_asset_public_url.toString(),
  });
  if (cursor) {
    params.append("cursor", cursor);
  }
  return await service.get(
    `/api/session/${session_id}/messages?${params.toString()}`
  );
};

export interface MessagePartIn {
  type: PartType;
  text?: string;
  file_field?: string;
  meta?: Record<string, unknown>;
}

export const storeMessage = async (
  session_id: string,
  role: MessageRole,
  parts: MessagePartIn[],
  files?: Record<string, File>
): Promise<Res<null>> => {
  // Check if there are files to upload
  const hasFiles = files && Object.keys(files).length > 0;

  if (hasFiles) {
    // Use multipart/form-data
    const formData = new FormData();

    // Add payload field (JSON string)
    // Wrap in blob field as expected by the Go API
    // Note: format parameter will be added by the Next.js API route
    formData.append("payload", JSON.stringify({
      blob: {
        role,
        parts
      }
    }));

    // Add files
    for (const [fieldName, file] of Object.entries(files!)) {
      formData.append(fieldName, file);
    }

    // FormData will automatically set Content-Type to multipart/form-data
    return await service.post(`/api/session/${session_id}/messages`, formData);
  } else {
    // Use JSON format
    // Wrap in blob field as expected by the Go API
    // Note: format parameter will be added by the Next.js API route
    return await service.post(`/api/session/${session_id}/messages`, {
      blob: {
        role,
        parts
      }
    });
  }
};

// Block APIs - Unified API for page, folder, text, sop, etc.

/**
 * List blocks with optional type and parent_id filters
 * - No params: returns top-level pages and folders
 * - type only: returns all blocks of that type at root level (for page/folder) or with parent (for others)
 * - parent_id only: returns all blocks under that parent
 * - both: returns blocks of specific type under that parent
 */
export const listBlocks = async (
  spaceId: string,
  options?: {
    type?: string;
    parentId?: string;
  }
): Promise<Res<Block[]>> => {
  const params = new URLSearchParams();
  if (options?.type) params.append("type", options.type);
  if (options?.parentId) params.append("parent_id", options.parentId);

  const queryString = params.toString();
  return await service.get(
    `/api/space/${spaceId}/block${queryString ? `?${queryString}` : ""}`
  );
};

/**
 * Create a block (page, folder, text, sop, etc.)
 * - For page and folder: parent_id is optional
 * - For other types: parent_id is required
 */
export const createBlock = async (
  spaceId: string,
  data: {
    type: string;
    parent_id?: string;
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<Res<Block>> => {
  return await service.post(`/api/space/${spaceId}/block`, data);
};

/**
 * Delete a block (works for all types: page, folder, text, sop, etc.)
 */
export const deleteBlock = async (
  spaceId: string,
  blockId: string
): Promise<Res<null>> => {
  return await service.delete(`/api/space/${spaceId}/block/${blockId}`);
};

/**
 * Get block properties (works for all types)
 */
export const getBlockProperties = async (
  spaceId: string,
  blockId: string
): Promise<Res<Block>> => {
  return await service.get(
    `/api/space/${spaceId}/block/${blockId}/properties`
  );
};

/**
 * Update block properties (works for all types)
 */
export const updateBlockProperties = async (
  spaceId: string,
  blockId: string,
  data: {
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<Res<null>> => {
  return await service.put(
    `/api/space/${spaceId}/block/${blockId}/properties`,
    data
  );
};

/**
 * Move a block (works for all types)
 * - For page and folder: parent_id can be null (move to root)
 * - For other types: parent_id is required
 */
export const moveBlock = async (
  spaceId: string,
  blockId: string,
  data: {
    parent_id?: string | null;
    sort?: number;
  }
): Promise<Res<null>> => {
  return await service.put(
    `/api/space/${spaceId}/block/${blockId}/move`,
    data
  );
};

/**
 * Update block sort order (works for all types)
 */
export const updateBlockSort = async (
  spaceId: string,
  blockId: string,
  sort: number
): Promise<Res<null>> => {
  return await service.put(`/api/space/${spaceId}/block/${blockId}/sort`, {
    sort,
  });
};

// Task APIs
export const getTasks = async (
  session_id: string,
  limit: number = 20,
  cursor?: string
): Promise<Res<GetTasksResp>> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  if (cursor) {
    params.append("cursor", cursor);
  }
  return await service.get(
    `/api/session/${session_id}/task?${params.toString()}`
  );
};


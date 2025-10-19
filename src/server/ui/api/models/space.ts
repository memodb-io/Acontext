import service, { Res } from "../http";
import { Space, Session, GetMessagesResp, Block } from "@/types";

// Space APIs
export const getSpaces = async (): Promise<Res<Space[]>> => {
  return await service.get("/api/space");
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
  notConnected?: boolean
): Promise<Res<Session[]>> => {
  const params = new URLSearchParams();
  if (spaceId) {
    params.append("space_id", spaceId);
  }
  if (notConnected !== undefined) {
    params.append("not_connected", notConnected.toString());
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
  type: "text" | "image" | "audio" | "video" | "file" | "tool-call" | "tool-result" | "data";
  text?: string;
  file_field?: string;
  meta?: Record<string, unknown>;
}

export const sendMessage = async (
  session_id: string,
  role: "user" | "assistant" | "system" | "tool" | "function",
  parts: MessagePartIn[],
  files?: Record<string, File>
): Promise<Res<null>> => {
  // Check if there are files to upload
  const hasFiles = files && Object.keys(files).length > 0;

  if (hasFiles) {
    // Use multipart/form-data
    const formData = new FormData();

    // Add payload field (JSON string)
    formData.append("payload", JSON.stringify({ role, parts }));

    // Add files
    for (const [fieldName, file] of Object.entries(files!)) {
      formData.append(fieldName, file);
    }

    // FormData will automatically set Content-Type to multipart/form-data
    return await service.post(`/api/session/${session_id}/messages`, formData);
  } else {
    // Use JSON format
    return await service.post(`/api/session/${session_id}/messages`, {
      role,
      parts,
    });
  }
};

// Page & Block APIs

// Folder APIs
export const getFolders = async (
  spaceId: string,
  parentId?: string
): Promise<Res<Block[]>> => {
  const params = parentId
    ? new URLSearchParams({ parent_id: parentId })
    : undefined;
  const queryString = params ? `?${params.toString()}` : "";
  return await service.get(`/api/space/${spaceId}/folder${queryString}`);
};

export const createFolder = async (
  spaceId: string,
  data: {
    parent_id?: string;
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<Res<Block>> => {
  return await service.post(`/api/space/${spaceId}/folder`, data);
};

export const deleteFolder = async (
  spaceId: string,
  folderId: string
): Promise<Res<null>> => {
  return await service.delete(`/api/space/${spaceId}/folder/${folderId}`);
};

export const getFolderProperties = async (
  spaceId: string,
  folderId: string
): Promise<Res<Block>> => {
  return await service.get(`/api/space/${spaceId}/folder/${folderId}/properties`);
};

export const updateFolderProperties = async (
  spaceId: string,
  folderId: string,
  data: {
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<Res<null>> => {
  return await service.put(
    `/api/space/${spaceId}/folder/${folderId}/properties`,
    data
  );
};

export const moveFolder = async (
  spaceId: string,
  folderId: string,
  data: {
    parent_id?: string | null;
    sort?: number;
  }
): Promise<Res<null>> => {
  return await service.put(`/api/space/${spaceId}/folder/${folderId}/move`, data);
};

export const updateFolderSort = async (
  spaceId: string,
  folderId: string,
  sort: number
): Promise<Res<null>> => {
  return await service.put(`/api/space/${spaceId}/folder/${folderId}/sort`, {
    sort,
  });
};

// Page APIs
export const getPages = async (
  spaceId: string,
  parentId?: string
): Promise<Res<Block[]>> => {
  const params = parentId
    ? new URLSearchParams({ parent_id: parentId })
    : undefined;
  const queryString = params ? `?${params.toString()}` : "";
  return await service.get(`/api/space/${spaceId}/page${queryString}`);
};

export const createPage = async (
  spaceId: string,
  data: {
    parent_id?: string;
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<Res<Block>> => {
  return await service.post(`/api/space/${spaceId}/page`, data);
};

export const deletePage = async (
  spaceId: string,
  pageId: string
): Promise<Res<null>> => {
  return await service.delete(`/api/space/${spaceId}/page/${pageId}`);
};

export const getPageProperties = async (
  spaceId: string,
  pageId: string
): Promise<Res<Block>> => {
  return await service.get(`/api/space/${spaceId}/page/${pageId}/properties`);
};

export const updatePageProperties = async (
  spaceId: string,
  pageId: string,
  data: {
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<Res<null>> => {
  return await service.put(
    `/api/space/${spaceId}/page/${pageId}/properties`,
    data
  );
};

export const movePage = async (
  spaceId: string,
  pageId: string,
  data: {
    parent_id?: string | null;
    sort?: number;
  }
): Promise<Res<null>> => {
  return await service.put(`/api/space/${spaceId}/page/${pageId}/move`, data);
};

export const updatePageSort = async (
  spaceId: string,
  pageId: string,
  sort: number
): Promise<Res<null>> => {
  return await service.put(`/api/space/${spaceId}/page/${pageId}/sort`, {
    sort,
  });
};

// Block APIs
export const getBlocks = async (
  spaceId: string,
  parentId: string
): Promise<Res<Block[]>> => {
  const params = new URLSearchParams({ parent_id: parentId });
  return await service.get(`/api/space/${spaceId}/block?${params.toString()}`);
};

export const createBlock = async (
  spaceId: string,
  data: {
    parent_id: string;
    type: string;
    title?: string;
    props?: Record<string, unknown>;
  }
): Promise<Res<Block>> => {
  return await service.post(`/api/space/${spaceId}/block`, data);
};

export const deleteBlock = async (
  spaceId: string,
  blockId: string
): Promise<Res<null>> => {
  return await service.delete(`/api/space/${spaceId}/block/${blockId}`);
};

export const getBlockProperties = async (
  spaceId: string,
  blockId: string
): Promise<Res<Block>> => {
  return await service.get(
    `/api/space/${spaceId}/block/${blockId}/properties`
  );
};

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

export const moveBlock = async (
  spaceId: string,
  blockId: string,
  data: {
    parent_id: string;
    sort?: number;
  }
): Promise<Res<null>> => {
  return await service.put(
    `/api/space/${spaceId}/block/${blockId}/move`,
    data
  );
};

export const updateBlockSort = async (
  spaceId: string,
  blockId: string,
  sort: number
): Promise<Res<null>> => {
  return await service.put(`/api/space/${spaceId}/block/${blockId}/sort`, {
    sort,
  });
};


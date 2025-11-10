import service, { Res } from "../http";
import { Disk, ListArtifactsResp, GetArtifactResp, GetDisksResp } from "@/types";

export const getDisks = async (
  limit: number = 20,
  cursor?: string,
  time_desc: boolean = false
): Promise<Res<GetDisksResp>> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    time_desc: time_desc.toString(),
  });
  if (cursor) {
    params.append("cursor", cursor);
  }
  return await service.get(
    `/api/disk?${params.toString()}`
  );
};

export const getListArtifacts = async (
  disk_id: string,
  path: string
): Promise<Res<ListArtifactsResp>> => {
  return await service.get(`/api/disk/${disk_id}/artifact/ls?path=${path}`);
};

export const getArtifact = async (
  disk_id: string,
  file_path: string,
  with_content: boolean = true
): Promise<Res<GetArtifactResp>> => {
  return await service.get(
    `/api/disk/${disk_id}/artifact?file_path=${encodeURIComponent(file_path)}&with_content=${with_content}`
  );
};

export const createDisk = async (): Promise<Res<Disk>> => {
  return await service.post("/api/disk");
};

export const deleteDisk = async (
  disk_id: string
): Promise<Res<null>> => {
  return await service.delete(`/api/disk/${disk_id}`);
};

export const uploadArtifact = async (
  disk_id: string,
  file_path: string,
  file: File,
  meta?: Record<string, string>
): Promise<Res<null>> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("file_path", file_path);
  if (meta && Object.keys(meta).length > 0) {
    formData.append("meta", JSON.stringify(meta));
  }

  const response = await fetch(`/api/disk/${disk_id}/artifact`, {
    method: "POST",
    body: formData,
  });

  return await response.json();
};

export const deleteArtifact = async (
  disk_id: string,
  file_path: string
): Promise<Res<null>> => {
  return await service.delete(
    `/api/disk/${disk_id}/artifact?file_path=${encodeURIComponent(
      file_path
    )}`
  );
};

export const updateArtifactMeta = async (
  disk_id: string,
  file_path: string,
  meta: Record<string, unknown>
): Promise<Res<null>> => {
  return await service.put(`/api/disk/${disk_id}/artifact`, {
    file_path,
    meta: JSON.stringify(meta),
  });
};


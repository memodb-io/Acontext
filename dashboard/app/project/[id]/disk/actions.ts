"use server";

import {
  AcontextClient,
  type Disk,
  type ListArtifactsResp,
  type GetArtifactResp,
  type GetDisksResp,
} from "@/lib/acontext/server";

export async function getDisks(
  projectId: string,
  limit: number = 20,
  cursor?: string,
  timeDesc: boolean = false,
  user?: string
): Promise<GetDisksResp> {
  try {
    const client = new AcontextClient();
    return await client.getDisks(projectId, limit, cursor, timeDesc, user);
  } catch (error) {
    console.error("Failed to fetch disks:", error);
    throw error;
  }
}

export async function getListArtifacts(
  projectId: string,
  diskId: string,
  path: string
): Promise<ListArtifactsResp> {
  try {
    const client = new AcontextClient();
    return await client.getListArtifacts(projectId, diskId, path);
  } catch (error) {
    console.error("Failed to list artifacts:", error);
    throw error;
  }
}

export async function getArtifact(
  projectId: string,
  diskId: string,
  filePath: string,
  withContent: boolean = true
): Promise<GetArtifactResp> {
  try {
    const client = new AcontextClient();
    return await client.getArtifact(projectId, diskId, filePath, withContent);
  } catch (error) {
    console.error("Failed to get artifact:", error);
    throw error;
  }
}

export async function createDisk(projectId: string, user?: string): Promise<Disk> {
  try {
    const client = new AcontextClient();
    return await client.createDisk(projectId, user);
  } catch (error) {
    console.error("Failed to create disk:", error);
    throw error;
  }
}

export async function deleteDisk(projectId: string, diskId: string): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.deleteDisk(projectId, diskId);
  } catch (error) {
    console.error("Failed to delete disk:", error);
    throw error;
  }
}

export async function uploadArtifact(
  projectId: string,
  diskId: string,
  filePath: string,
  file: File,
  meta?: Record<string, string>
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.uploadArtifact(projectId, diskId, filePath, file, meta);
  } catch (error) {
    console.error("Failed to upload artifact:", error);
    throw error;
  }
}

export async function deleteArtifact(
  projectId: string,
  diskId: string,
  filePath: string
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.deleteArtifact(projectId, diskId, filePath);
  } catch (error) {
    console.error("Failed to delete artifact:", error);
    throw error;
  }
}

export async function updateArtifactMeta(
  projectId: string,
  diskId: string,
  filePath: string,
  meta: Record<string, unknown>
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.updateArtifactMeta(projectId, diskId, filePath, meta);
  } catch (error) {
    console.error("Failed to update artifact metadata:", error);
    throw error;
  }
}

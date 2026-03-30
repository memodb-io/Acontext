"use server";

import {
  getCurrentUser,
  getProject,
  getOrganizationMembershipForCurrentUser,
} from "@/lib/supabase";
import { AcontextClient, type ProjectConfig } from "@/lib/acontext/server";

export async function getProjectConfigs(
  projectId: string
): Promise<{ data?: ProjectConfig; error?: string }> {
  try {
    await getCurrentUser();

    const project = await getProject(projectId);
    if (!project) {
      return { error: "Project not found" };
    }

    const membership = await getOrganizationMembershipForCurrentUser(
      project.organization_id,
      "role"
    );
    if (!membership) {
      return { error: "Project not found or access denied" };
    }

    const client = new AcontextClient();
    const configs = await client.getProjectConfigs(projectId);
    return { data: configs };
  } catch (error) {
    return {
      error: `Failed to load project configs: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function updateProjectConfigs(
  projectId: string,
  configs: Partial<ProjectConfig>
): Promise<{ data?: ProjectConfig; error?: string }> {
  try {
    await getCurrentUser();

    const project = await getProject(projectId);
    if (!project) {
      return { error: "Project not found" };
    }

    const membership = await getOrganizationMembershipForCurrentUser(
      project.organization_id,
      "role"
    );
    if (!membership) {
      return { error: "Project not found or access denied" };
    }
    if (membership.role !== "owner") {
      return { error: "Only organization owners can update project configs" };
    }

    const client = new AcontextClient();
    const updated = await client.updateProjectConfigs(projectId, configs);
    return { data: updated };
  } catch (error) {
    return {
      error: `Failed to update project configs: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

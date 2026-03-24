"use server";

import { revalidatePath } from "next/cache";
import { encodeId } from "@/lib/id-codec";
import { MAX_PROJECT_NAME_LENGTH } from "@/lib/utils";
import {
  getCurrentUser,
  getProject,
  updateProject,
  deleteProject,
  getOrganizationMembershipForCurrentUser,
} from "@/lib/supabase";
import { AcontextClient, type ProjectConfig } from "@/lib/acontext/server";

export async function updateProjectName(projectId: string, name: string) {
  // Validate name
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Project name is required" };
  }

  if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
    return {
      error: `Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or less`,
    };
  }

  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project to verify access
  const project = await getProject(projectId);
  if (!project) {
    return { error: "Project not found" };
  }

  // Check if user is a member of the organization
  const membership = await getOrganizationMembershipForCurrentUser(
    project.organization_id,
    "role"
  );

  if (!membership) {
    return { error: "Project not found or access denied" };
  }

  // Check if user is owner
  if (membership.role !== "owner") {
    return { error: "Only organization owners can rename projects" };
  }

  // Update project name
  const { error: updateError } = await updateProject(projectId, {
    name: trimmedName,
  });

  if (updateError) {
    return { error: "Failed to update project name" };
  }

  const encodedProjectId = encodeId(projectId);
  const encodedOrgId = encodeId(project.organization_id);
  revalidatePath(`/project/${encodedProjectId}`, "layout");
  revalidatePath(`/org/${encodedOrgId}`, "layout");
  revalidatePath("/organizations", "layout");

  return { success: true };
}

export async function deleteProjectAction(projectId: string) {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project to verify access and get organization_id
  const project = await getProject(projectId);
  if (!project) {
    return { error: "Project not found" };
  }

  // Check if user is a member of the organization
  const membership = await getOrganizationMembershipForCurrentUser(
    project.organization_id,
    "role"
  );

  if (!membership) {
    return { error: "Project not found or access denied" };
  }

  // Check if user is owner
  if (membership.role !== "owner") {
    return { error: "Only organization owners can delete projects" };
  }

  // Delete project from external service
  try {
    const client = new AcontextClient();
    await client.deleteProjects([projectId]);
  } catch (error) {
    return {
      error: `Failed to delete project from external service: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }

  // Delete project from database
  const { error: deleteError } = await deleteProject(projectId);

  if (deleteError) {
    return { error: "Failed to delete project" };
  }

  const encodedOrgId = encodeId(project.organization_id);
  revalidatePath(`/org/${encodedOrgId}`, "layout");
  revalidatePath("/organizations", "layout");
  revalidatePath("/", "layout");

  return { success: true };
}

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

async function toggleProjectEncryption(
  projectId: string,
  apiKey: string,
  action: "encrypt" | "decrypt"
): Promise<{ success?: boolean; error?: string }> {
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
      return { error: `Only organization owners can ${action === "encrypt" ? "enable" : "disable"} encryption` };
    }

    const client = new AcontextClient();
    if (action === "encrypt") {
      await client.encryptProject(projectId, apiKey);
    } else {
      await client.decryptProject(projectId, apiKey);
    }

    const encodedProjectId = encodeId(projectId);
    revalidatePath(`/project/${encodedProjectId}`, "layout");

    return { success: true };
  } catch (error) {
    return {
      error: `Failed to ${action} project: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function encryptProjectAction(
  projectId: string,
  apiKey: string
): Promise<{ success?: boolean; error?: string }> {
  return toggleProjectEncryption(projectId, apiKey, "encrypt");
}

export async function decryptProjectAction(
  projectId: string,
  apiKey: string
): Promise<{ success?: boolean; error?: string }> {
  return toggleProjectEncryption(projectId, apiKey, "decrypt");
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


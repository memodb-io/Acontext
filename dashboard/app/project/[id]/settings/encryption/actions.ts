"use server";

import { revalidatePath } from "next/cache";
import { encodeId } from "@/lib/id-codec";
import {
  getCurrentUser,
  getProject,
  getOrganizationMembershipForCurrentUser,
} from "@/lib/supabase";
import { AcontextClient } from "@/lib/acontext/server";

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

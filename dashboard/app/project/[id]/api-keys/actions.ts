"use server";

import { revalidatePath } from "next/cache";
import { encodeId } from "@/lib/id-codec";
import {
  getCurrentUser,
  getProject,
  getOrganizationMembershipForCurrentUser,
  getSecretKeyRotations,
  createSecretKeyRotation,
} from "@/lib/supabase";
import { AcontextClient } from "@/lib/acontext/server";

/**
 * Mask a secret key: show first 8 and last 8 characters with ***** in between
 */
function maskSecretKey(key: string): string {
  if (key.length <= 16) {
    // If key is too short, just mask most of it
    return key.slice(0, 4) + "*****" + key.slice(-4);
  }
  return key.slice(0, 8) + "*****" + key.slice(-8);
}

/**
 * Get secret key history for a project
 */
export async function getSecretKeyHistory(projectId: string) {
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

  try {
    const rotations = await getSecretKeyRotations(projectId);
    return { success: true, data: rotations };
  } catch (error) {
    return {
      error: `Failed to fetch secret key history: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Rotate (generate new) secret key for a project
 * Returns the full key for one-time display
 */
export async function rotateSecretKey(projectId: string) {
  // Get current user (will redirect if not authenticated)
  const user = await getCurrentUser();

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
    return { error: "Only organization owners can rotate secret keys" };
  }

  try {
    // Call API to generate new secret key
    const client = new AcontextClient();
    const fullSecretKey = await client.updateProjectSecretKey(projectId);

    if (!fullSecretKey) {
      return { error: "Failed to generate secret key" };
    }

    // Mask the key for storage
    const maskedKey = maskSecretKey(fullSecretKey);

    // Save masked key to database
    const userEmail = user.email || "unknown";
    const { error: insertError } = await createSecretKeyRotation(
      projectId,
      userEmail,
      maskedKey
    );

    if (insertError) {
      console.error("Failed to save secret key rotation:", insertError);
      // Still return the key even if saving fails
    }

    const encodedProjectId = encodeId(projectId);
    revalidatePath(`/project/${encodedProjectId}/api-keys`);

    // Return full key for one-time display
    return { success: true, secretKey: fullSecretKey };
  } catch (error) {
    return {
      error: `Failed to rotate secret key: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}


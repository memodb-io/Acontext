"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MAX_PROJECT_NAME_LENGTH } from "@/lib/utils";
import { encodeId } from "@/lib/id-codec";
import { AcontextClient } from "@/lib/acontext/server";
import {
  getCurrentUser,
  getOrganizationMembershipForCurrentUser,
  createOrganizationProject,
} from "@/lib/supabase";

export async function createProject(orgId: string, formData: FormData) {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Verify user is a member of the organization
  const membership = await getOrganizationMembershipForCurrentUser(orgId, "role");

  if (!membership) {
    notFound();
  }

  // Convert organization ID to Base64URL for URL
  const encodedOrgId = encodeId(orgId);

  const name = formData.get("name") as string;

  if (!name || name.trim() === "") {
    redirect(`/new/${encodedOrgId}?error=${encodeURIComponent("Name is required")}`);
  }

  const trimmedName = name.trim();
  if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
    redirect(
      `/new/${encodedOrgId}?error=${encodeURIComponent(`Name must be ${MAX_PROJECT_NAME_LENGTH} characters or less`)}`
    );
  }

  // Create project via acontext API
  const client = new AcontextClient();
  const projectId = await client.createProject();

  // Call Supabase Database Function to create project
  const { data, error } = await createOrganizationProject({
    p_org_id: orgId,
    p_project_name: trimmedName,
    p_project_id: projectId,
  });

  if (error) {
    redirect(`/new/${encodedOrgId}?error=${encodeURIComponent(error.message)}`);
  }

  if (!data) {
    redirect(`/new/${encodedOrgId}?error=${encodeURIComponent("Failed to create project")}`);
  }

  // Convert project ID to Base64URL for URL
  const encodedProjectId = encodeId(projectId);

  revalidatePath("/", "layout");
  redirect(`/project/${encodedProjectId}/onboarding`);
}


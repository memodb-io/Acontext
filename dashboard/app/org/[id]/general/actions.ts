"use server";

import { revalidatePath } from "next/cache";
import { encodeId } from "@/lib/id-codec";
import { MAX_ORG_NAME_LENGTH } from "@/lib/utils";
import {
  getCurrentUser,
  getOrganizationMembershipForCurrentUser,
  updateOrganization as updateOrg,
  deleteOrganization as deleteOrg,
  getOrganizationProjects,
} from "@/lib/supabase";
import { deleteCustomer } from "@/lib/supabase/operations/prices";
import { AcontextClient } from "@/lib/acontext/server";

export async function updateOrganizationName(orgId: string, name: string) {
  // Validate name
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Organization name is required" };
  }

  if (trimmedName.length > MAX_ORG_NAME_LENGTH) {
    return {
      error: `Organization name must be ${MAX_ORG_NAME_LENGTH} characters or less`,
    };
  }

  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Check if user is a member of this organization
  const membership = await getOrganizationMembershipForCurrentUser(orgId, "role");

  if (!membership) {
    return { error: "Organization not found or access denied" };
  }

  // Check if user is owner
  if (membership.role !== "owner") {
    return { error: "Only organization owners can rename organizations" };
  }

  // Update organization name
  const { error: updateError } = await updateOrg(orgId, {
    name: trimmedName,
  });

  if (updateError) {
    return { error: "Failed to update organization name" };
  }

  const encodedOrgId = encodeId(orgId);
  revalidatePath(`/org/${encodedOrgId}`, "layout");
  revalidatePath("/organizations", "layout");

  return { success: true };
}

export async function deleteOrganization(orgId: string) {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Check if user is a member of this organization and get organization details
  const membership = await getOrganizationMembershipForCurrentUser(
    orgId,
    `
      role,
      organizations (
        id,
        is_default
      )
    `
  );

  if (!membership) {
    return { error: "Organization not found or access denied" };
  }

  // Check if user is owner
  if (membership.role !== "owner") {
    return { error: "Only organization owners can delete organizations" };
  }

  // Get organization details
  const orgData = membership.organizations as unknown;
  const org = Array.isArray(orgData) ? orgData[0] : orgData;

  if (!org || typeof org !== "object" || !("id" in org)) {
    return { error: "Organization not found" };
  }

  const orgObj = org as {
    id: string;
    is_default: boolean;
  };

  // Prevent deletion of default organization
  if (orgObj.is_default) {
    return { error: "Cannot delete default organization" };
  }

  // Delete projects from external service before deleting the organization
  const projects = await getOrganizationProjects(orgId);
  if (projects.length > 0) {
    const projectIds = projects.map((p) => p.project_id);
    try {
      const client = new AcontextClient();
      await client.deleteProjects(projectIds);
    } catch (error) {
      return {
        error: `Failed to delete projects from external service: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // Delete Stripe customer and cancel subscriptions before deleting organization
  try {
    const deleteCustomerResult = await deleteCustomer(orgId);
    if (!deleteCustomerResult.success && deleteCustomerResult.error) {
      console.error("Failed to delete Stripe customer:", deleteCustomerResult.error);
      // Continue with organization deletion even if Stripe cleanup fails
      // The customer/subscription can be manually cleaned up later
    }
  } catch (error) {
    console.error("Error deleting Stripe customer:", error);
    // Continue with organization deletion
  }

  // Delete organization - CASCADE will automatically delete related records:
  // - organization_billing
  // - organization_members
  // - organization_projects (database records only)
  const { error: orgError } = await deleteOrg(orgId);

  if (orgError) {
    return { error: "Failed to delete organization" };
  }

  revalidatePath("/organizations", "layout");
  revalidatePath("/", "layout");

  return { success: true };
}


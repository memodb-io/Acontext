"use server";

import { revalidatePath } from "next/cache";
import { encodeId } from "@/lib/id-codec";
import {
  getCurrentUser,
  getOrganizationMembershipForCurrentUser,
  addOrganizationMemberByEmail,
  removeOrganizationMember,
} from "@/lib/supabase";

export async function inviteMember(orgId: string, email: string, role: "owner" | "member") {
  // Validate email
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) {
    return { error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { error: "Invalid email format" };
  }

  // Validate role
  if (role !== "owner" && role !== "member") {
    return { error: "Invalid role" };
  }

  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Check if user is a member of this organization
  const membership = await getOrganizationMembershipForCurrentUser(orgId, "role");

  if (!membership) {
    return { error: "Organization not found or access denied" };
  }

  // Check if user is owner (only owners can invite members)
  if (membership.role !== "owner") {
    return { error: "Only organization owners can invite members" };
  }

  // Add member
  const { error: addError } = await addOrganizationMemberByEmail(orgId, trimmedEmail, role);

  if (addError) {
    return { error: addError.message || "Failed to invite member" };
  }

  const encodedOrgId = encodeId(orgId);
  revalidatePath(`/org/${encodedOrgId}/team`, "page");
  revalidatePath(`/org/${encodedOrgId}`, "layout");

  return { success: true };
}

export async function removeMember(orgId: string, userId: string) {
  // Get current user (will redirect if not authenticated)
  const currentUser = await getCurrentUser();

  // Check if user is a member of this organization
  const membership = await getOrganizationMembershipForCurrentUser(orgId, "role");

  if (!membership) {
    return { error: "Organization not found or access denied" };
  }

  // Check if user is owner (only owners can remove members)
  if (membership.role !== "owner") {
    return { error: "Only organization owners can remove members" };
  }

  // Prevent removing yourself
  if (currentUser.id === userId) {
    return { error: "You cannot remove yourself from the organization" };
  }

  // Remove member
  const { error: removeError } = await removeOrganizationMember(orgId, userId);

  if (removeError) {
    return { error: removeError.message || "Failed to remove member" };
  }

  const encodedOrgId = encodeId(orgId);
  revalidatePath(`/org/${encodedOrgId}/team`, "page");
  revalidatePath(`/org/${encodedOrgId}`, "layout");

  return { success: true };
}


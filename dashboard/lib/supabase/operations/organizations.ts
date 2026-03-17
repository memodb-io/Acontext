"use server";

import { createClient, createAdminClient } from "../server";
import { getCurrentUser } from "./auth";
import { PlanDescription, normalizePlan, PlanType } from "@/stores/plan";
import { Organization, Project } from "@/types";
import { getOrganizationProjects } from "./projects";

export interface OrganizationMembership {
  organization_id: string;
  role: "owner" | "member";
  created_at?: string;
  organizations?: {
    id: string;
    name: string;
    is_default: boolean;
    created_at?: string;
    organization_billing?: Array<{ plan: string }> | { plan: string };
    organization_projects?: Array<{ project_id: string }>;
  };
}

/**
 * Get user's membership for a specific organization
 */
export async function getOrganizationMembership(
  userId: string,
  orgId: string,
  select?: string
): Promise<OrganizationMembership | null> {
  const supabase = await createClient();
  const query = supabase
    .from("organization_members")
    .select(select || "role, organizations (*)")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .single();

  const { data, error } = await query;

  if (error || !data) {
    return null;
  }

  return data as unknown as OrganizationMembership;
}

/**
 * Get all user's organization memberships
 */
export async function getOrganizationMemberships(
  userId: string,
  select?: string
): Promise<OrganizationMembership[]> {
  const supabase = await createClient();
  const query = supabase
    .from("organization_members")
    .select(select || "organization_id, role, organizations (*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data as unknown as OrganizationMembership[];
}

/**
 * Get organization membership with current user (requires auth)
 */
export async function getOrganizationMembershipForCurrentUser(
  orgId: string,
  select?: string
): Promise<OrganizationMembership | null> {
  const user = await getCurrentUser();
  return await getOrganizationMembership(user.id, orgId, select);
}

/**
 * Get all organization memberships for current user (requires auth)
 */
export async function getOrganizationMembershipsForCurrentUser(
  select?: string
): Promise<OrganizationMembership[]> {
  const user = await getCurrentUser();
  return await getOrganizationMemberships(user.id, select);
}

/**
 * Check if user is owner of organization
 */
export async function isOrganizationOwner(
  userId: string,
  orgId: string
): Promise<boolean> {
  const membership = await getOrganizationMembership(userId, orgId, "role");
  return membership?.role === "owner";
}

/**
 * Check if current user is owner of organization (requires auth)
 */
export async function isCurrentUserOrganizationOwner(
  orgId: string
): Promise<boolean> {
  const user = await getCurrentUser();
  return await isOrganizationOwner(user.id, orgId);
}

/**
 * Get organization details
 */
export async function getOrganization(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Update organization
 */
export async function updateOrganization(
  orgId: string,
  updates: { name?: string; [key: string]: unknown }
) {
  const supabase = await createClient();
  return await supabase.from("organizations").update(updates).eq("id", orgId);
}

/**
 * Delete organization
 */
export async function deleteOrganization(orgId: string) {
  const supabase = await createClient();
  return await supabase.from("organizations").delete().eq("id", orgId);
}

/**
 * Create organization using RPC
 */
export async function createOrganization(orgName: string, orgPlan: string) {
  const supabase = await createClient();
  return await supabase.rpc("create_organization", {
    org_name: orgName,
    org_plan: orgPlan,
  });
}

/**
 * Get product plans
 */
export async function getProductPlans(): Promise<{ product: string; plan: string; description: PlanDescription }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_plans")
    .select("product, plan, description")
    .order("plan", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Get all members of an organization
 * Note: This requires a database function or view to get user info from auth.users
 * For now, we'll return basic member info
 */
export interface OrganizationMember {
  user_id: string;
  role: "owner" | "member";
  created_at: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

export async function getOrganizationMembers(
  orgId: string
): Promise<OrganizationMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  // Get user info from auth.users using admin API or RPC
  const members: OrganizationMember[] = data.map((member) => ({
    user_id: member.user_id,
    role: member.role as "owner" | "member",
    created_at: member.created_at,
  }));

  try {
    const supabase = await createAdminClient();

    // Fetch user details for each member
    const memberPromises = members.map(async (member) => {
      try {
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(member.user_id);

        if (userError) {
          return member;
        }

        const user = userData?.user;
        if (!user) {
          return member;
        }

        const rawUserMetadata = user.user_metadata || {};

        return {
          ...member,
          email: user.email || undefined,
          avatar_url:
            rawUserMetadata.avatar_url ||
            rawUserMetadata.picture ||
            rawUserMetadata.avatar ||
            undefined,
        };
      } catch {
        return member;
      }
    });

    return await Promise.all(memberPromises);
  } catch {
    return members;
  }
}

/**
 * Add a member to an organization by email
 */
export async function addOrganizationMemberByEmail(
  orgId: string,
  email: string,
  role: "owner" | "member"
) {
  const supabase = await createAdminClient();

  let user = null;

  const { data: inviteData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    if (inviteError.code !== "email_exists") {
      return { error: { message: "Error inviting user" } };
    }
    user = inviteData?.user;
  }

  const { data: userData, error: userError } = await supabase.rpc(
    "get_user_id_by_email",
    {
      email,
    }
  );
  if (userError && !userData) {
    return { error: { message: "Error getting user" } };
  }
  user = userData[0];

  if (!user) {
    return { error: { message: "User not found" } };
  }

  // Add member
  const { data, error } = await supabase.from("organization_members").insert({
    organization_id: orgId,
    user_id: user.id,
    role: role,
  });

  if (error) {
    return { error };
  }

  return { data, error: null };
}

/**
 * Remove a member from an organization
 */
export async function removeOrganizationMember(orgId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId);

  if (error) {
    return { error };
  }

  return { error: null };
}

/**
 * Get organization usage and plan limits
 */
export interface OrganizationUsageData {
  usage: {
    current_task: number;
    current_skill: number;
    current_fast_skill_search: number;
    current_agentic_skill_search: number;
    current_storage: number;
  };
  limits: {
    max_task: number;
    max_skill: number;
    max_fast_skill_search: number;
    max_agentic_skill_search: number;
    max_storage: number;
  };
  period_end: string | null;
}

export async function getOrganizationUsage(
  orgId: string,
  plan: string
): Promise<OrganizationUsageData> {
  const supabase = await createClient();

  const [usageResult, limitsResult, billingResult] = await Promise.all([
    supabase
      .from("organization_usage")
      .select("current_task, current_skill, current_fast_skill_search, current_agentic_skill_search, current_storage")
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("product_plans")
      .select("max_task, max_skill, max_fast_skill_search, max_agentic_skill_search, max_storage")
      .eq("plan", plan)
      .single(),
    supabase
      .from("organization_billing")
      .select("period_end")
      .eq("organization_id", orgId)
      .single(),
  ]);

  const usage = usageResult.data || {
    current_task: 0,
    current_skill: 0,
    current_fast_skill_search: 0,
    current_agentic_skill_search: 0,
    current_storage: 0,
  };

  const limits = limitsResult.data || {
    max_task: 0,
    max_skill: 0,
    max_fast_skill_search: 0,
    max_agentic_skill_search: 0,
    max_storage: 0,
  };

  return {
    usage,
    limits,
    period_end: billingResult.data?.period_end || null,
  };
}

/**
 * Helper function to transform organization membership data
 */
function transformOrganizationFromMembership(
  membership: OrganizationMembership
): Organization | null {
  const orgData = membership.organizations as unknown;
  const org = Array.isArray(orgData) ? orgData[0] : orgData;

  if (!org || typeof org !== "object" || !("id" in org)) {
    return null;
  }

  const orgObj = org as {
    id: string;
    name: string;
    is_default?: boolean;
    organization_billing?: Array<{ plan: string }> | { plan: string };
  };

  const billing = Array.isArray(orgObj.organization_billing)
    ? orgObj.organization_billing[0]
    : orgObj.organization_billing;

  const plan = normalizePlan(billing?.plan);

  return {
    id: orgObj.id,
    name: orgObj.name,
    plan,
    is_default: orgObj.is_default,
    role: membership.role as "owner" | "member",
  };
}

/**
 * Get organization data with plan information for pages
 * This is a helper function that encapsulates the common pattern of:
 * - Getting current organization with plan
 * - Getting all user organizations with plans
 * - Optionally getting projects for the organization
 *
 * @param orgId - The organization ID
 * @param options - Optional configuration
 * @returns Organization data including current org, all orgs, and optionally projects
 */
export async function getOrganizationDataWithPlan(
  orgId: string,
  options?: {
    includeProjects?: boolean;
  }
): Promise<{
  currentOrganization: Organization;
  allOrganizations: Array<{ id: string; name: string; plan: PlanType }>;
  projects?: Project[];
}> {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  const selectQuery = `
    organization_id,
    role,
    organizations (
      id,
      name,
      is_default,
      organization_billing (
        plan
      )
    )
  `;

  // Get current organization with plan information
  const membership = await getOrganizationMembershipForCurrentUser(
    orgId,
    selectQuery
  );

  if (!membership) {
    throw new Error("Organization not found or access denied");
  }

  // Get all user's organizations for the selector
  const allMemberships = await getOrganizationMembershipsForCurrentUser(
    selectQuery
  );

  // Transform current organization
  const currentOrganization = transformOrganizationFromMembership(membership);
  if (!currentOrganization) {
    throw new Error("Failed to transform organization data");
  }

  // Transform all organizations
  const allOrganizations = allMemberships
    .map((m) => {
      const orgData = m.organizations as unknown;
      const org = Array.isArray(orgData) ? orgData[0] : orgData;

      if (!org || typeof org !== "object" || !("id" in org)) {
        return null;
      }

      const orgObj = org as {
        id: string;
        name: string;
        organization_billing?: Array<{ plan: string }> | { plan: string };
      };

      const billing = Array.isArray(orgObj.organization_billing)
        ? orgObj.organization_billing[0]
        : orgObj.organization_billing;

      const plan = normalizePlan(billing?.plan);

      return {
        id: orgObj.id,
        name: orgObj.name,
        plan,
      };
    })
    .filter(
      (org): org is { id: string; name: string; plan: PlanType } =>
        org !== null
    );

  const result: {
    currentOrganization: Organization;
    allOrganizations: Array<{ id: string; name: string; plan: PlanType }>;
    projects?: Project[];
  } = {
    currentOrganization,
    allOrganizations,
  };

  // Optionally get projects
  if (options?.includeProjects) {
    const orgProjects = await getOrganizationProjects(orgId);
    result.projects = orgProjects.map((p) => ({
      id: p.project_id,
      name: p.name,
      organization_id: orgId,
      created_at: p.created_at,
    }));
  }

  return result;
}

import { OrganizationsPageClient } from "./organizations-page-client";
import { normalizePlan } from "@/stores/plan";
import {
  getCurrentUser,
  getOrganizationMembershipsForCurrentUser,
} from "@/lib/supabase";
import { OrganizationWithPlan } from "@/types";

async function getOrganizations(): Promise<OrganizationWithPlan[]> {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get user's organizations with plan information and project count
  const memberships = await getOrganizationMembershipsForCurrentUser(
    `
      organization_id,
      role,
      created_at,
      organizations (
        id,
        name,
        is_default,
        created_at,
        organization_billing (
          plan
        ),
        organization_projects (
          project_id
        )
      )
    `
  );

  if (!memberships || memberships.length === 0) {
    return [];
  }

  // Transform the data to flatten the structure
  return memberships
    .map((membership) => {
      // Supabase returns organizations - handle both object and array cases
      const orgData = membership.organizations as unknown;

      // Check if it's an array (shouldn't be, but handle it)
      const org = Array.isArray(orgData) ? orgData[0] : orgData;

      if (!org || typeof org !== "object" || !("id" in org)) {
        return null;
      }

      const orgObj = org as {
        id: string;
        name: string;
        is_default: boolean;
        created_at: string;
        organization_billing?: Array<{ plan: string }> | { plan: string };
        organization_projects?: Array<{ project_id: string }>;
      };

      const billing = Array.isArray(orgObj.organization_billing)
        ? orgObj.organization_billing[0]
        : orgObj.organization_billing;

      // Count projects
      const projects = orgObj.organization_projects;
      const projectCount = Array.isArray(projects) ? projects.length : 0;

      // Normalize plan using helper function
      const plan = normalizePlan(billing?.plan);

      return {
        id: orgObj.id,
        name: orgObj.name,
        plan,
        is_default: orgObj.is_default || false,
        created_at: orgObj.created_at,
        role: membership.role as "owner" | "member",
        project_count: projectCount,
      };
    })
    .filter((org): org is OrganizationWithPlan => org !== null);
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();

  return <OrganizationsPageClient organizations={organizations} />;
}


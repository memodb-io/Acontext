import { redirect } from "next/navigation";
import { AcontextClient } from "@/lib/acontext/server";
import { encodeId } from "@/lib/id-codec";
import {
  getCurrentUser,
  getOrganizationMembershipsForCurrentUser,
  createOrganization,
  createOrganizationProject,
} from "@/lib/supabase";

export default async function Home() {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get user's first organization membership
  const memberships = await getOrganizationMembershipsForCurrentUser(
    "organization_id, role, organizations (is_default)"
  );
  const membership = memberships.find(
    (membership) =>
      membership.organizations && membership.organizations?.is_default
  );

  // If no membership found, create a default organization
  if (!membership) {
    // Create default organization using database function
    const defaultOrgName = "My Organization";

    const { data: newOrgId, error: createError } = await createOrganization(
      defaultOrgName,
      "free"
    );

    if (createError || !newOrgId) {
      // If creation fails, redirect to /new page
      redirect("/new");
    }

    // Create a default project for the new organization
    const defaultProjectName = "My Project";
    const client = new AcontextClient();
    const projectId = await client.createProject();
    const { error: projectError } = await createOrganizationProject({
      p_org_id: newOrgId,
      p_project_name: defaultProjectName,
      p_project_id: projectId,
    });

    // If project creation fails, still redirect to organization (project creation is not critical)
    if (projectError) {
      // Log error but don't block the redirect
      console.error("Failed to create default project:", projectError);
    }

    // Redirect to the newly created project (convert to Base64URL)
    const encodedProjectId = encodeId(projectId);
    redirect(`/project/${encodedProjectId}`);
  }

  // Redirect to the first organization (convert to Base64URL)
  const encodedOrgId = encodeId(membership.organization_id);
  redirect(`/org/${encodedOrgId}`);
}

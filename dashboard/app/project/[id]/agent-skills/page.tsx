import { redirect } from "next/navigation";
import { AgentSkillsPageClient } from "./agent-skills-page-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentSkillsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  // Decode ID if it's Base64URL encoded
  const actualProjectId = decodeId(projectId);

  // Get current user (automatically redirects if not authenticated)
  await getCurrentUser();

  // Get current project
  const project = await getProject(actualProjectId);

  if (!project) {
    redirect("/");
  }

  // Get organization data with plan information
  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(project.organization_id, {
      includeProjects: true,
    });
  } catch {
    redirect("/");
  }

  const { currentOrganization, allOrganizations, projects = [] } = orgData;

  return (
    <AgentSkillsPageClient
      project={{
        id: project.project_id,
        name: project.name,
        organization_id: project.organization_id,
        created_at: project.created_at,
      }}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
    />
  );
}

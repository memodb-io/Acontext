import { redirect } from "next/navigation";
import { AgentSkillDetailClient } from "./agent-skill-detail-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{ id: string; skillId: string }>;
}

export default async function AgentSkillDetailPage({ params }: PageProps) {
  const { id: projectId, skillId } = await params;
  const actualProjectId = decodeId(projectId);
  const actualSkillId = decodeId(skillId);

  await getCurrentUser();

  const project = await getProject(actualProjectId);

  if (!project) {
    redirect("/");
  }

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
    <AgentSkillDetailClient
      project={{
        id: project.project_id,
        name: project.name,
        organization_id: project.organization_id,
        created_at: project.created_at,
      }}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
      skillId={actualSkillId}
    />
  );
}

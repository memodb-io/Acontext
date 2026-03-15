import { notFound } from "next/navigation";
import { GeneralPageClient } from "./general-page-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
} from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";
import { getProjectConfigs } from "./actions";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getProjectData(projectId: string) {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project data
  const projectData = await getProject(projectId);

  if (!projectData) {
    notFound();
  }

  const project = {
    id: projectData.project_id,
    name: projectData.name,
    organization_id: projectData.organization_id,
  };

  // Get organization data with plan information
  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(project.organization_id, {
      includeProjects: true,
    });
  } catch {
    notFound();
  }

  const { currentOrganization, allOrganizations, projects = [] } = orgData;

  return {
    project,
    currentOrganization,
    allOrganizations,
    projects,
  };
}

export default async function GeneralPage({ params }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);
  const { project, currentOrganization, allOrganizations, projects } =
    await getProjectData(actualId);

  const configsResult = await getProjectConfigs(actualId);
  const projectConfigs = configsResult.data;

  return (
    <GeneralPageClient
      project={project}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
      role={currentOrganization.role ?? "member"}
      projectConfigs={projectConfigs}
      projectConfigsError={configsResult.error}
    />
  );
}


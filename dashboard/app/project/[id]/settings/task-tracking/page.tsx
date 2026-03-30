import { notFound } from "next/navigation";
import { TaskTrackingPageClient } from "./task-tracking-page-client";
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
  await getCurrentUser();

  const projectData = await getProject(projectId);

  if (!projectData) {
    notFound();
  }

  const project = {
    id: projectData.project_id,
    name: projectData.name,
    organization_id: projectData.organization_id,
  };

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

export default async function TaskTrackingPage({ params }: PageProps) {
  const { id } = await params;
  const actualId = decodeId(id);
  const { project, currentOrganization, allOrganizations, projects } =
    await getProjectData(actualId);

  const configsResult = await getProjectConfigs(actualId);
  const projectConfigs = configsResult.data;

  return (
    <TaskTrackingPageClient
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

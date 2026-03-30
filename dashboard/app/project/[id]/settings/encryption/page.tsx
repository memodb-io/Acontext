import { notFound } from "next/navigation";
import { EncryptionPageClient } from "./encryption-page-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
} from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";
import { getProjectApiKeyPrefix } from "@/lib/acontext/server";

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

export default async function EncryptionPage({ params }: PageProps) {
  const { id } = await params;
  const actualId = decodeId(id);
  const { project, currentOrganization, allOrganizations, projects } =
    await getProjectData(actualId);

  return (
    <EncryptionPageClient
      project={project}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
      role={currentOrganization.role ?? "member"}
      apiKeyPrefix={getProjectApiKeyPrefix()}
    />
  );
}

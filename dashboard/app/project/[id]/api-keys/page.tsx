import { notFound } from "next/navigation";
import { ApiKeysPageClient } from "./api-keys-page-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
  getSecretKeyRotations,
} from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";
import { getProjectApiKeyPrefix } from "@/lib/acontext/server";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getPageData(projectId: string) {
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

  // Get secret key rotations
  const keyRotations = await getSecretKeyRotations(projectId);

  return {
    project,
    currentOrganization,
    allOrganizations,
    projects,
    keyRotations,
  };
}

export default async function ApiKeysPage({ params }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);
  const { project, currentOrganization, allOrganizations, projects, keyRotations } =
    await getPageData(actualId);

  return (
    <ApiKeysPageClient
      project={project}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
      keyRotations={keyRotations}
      role={currentOrganization.role ?? "member"}
      apiKeyPrefix={getProjectApiKeyPrefix()}
    />
  );
}


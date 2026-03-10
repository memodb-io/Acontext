import { notFound } from "next/navigation";
import { ProjectPageClient } from "./project-page-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
} from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);

  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project data
  const projectData = await getProject(actualId);

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

  return (
    <ProjectPageClient
      project={project}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
    />
  );
}


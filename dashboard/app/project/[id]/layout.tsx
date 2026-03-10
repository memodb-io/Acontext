import { notFound } from "next/navigation";
import {
  cachedGetCurrentUser as getCurrentUser,
  cachedGetOrganizationMembershipForCurrentUser as getOrganizationMembershipForCurrentUser,
  cachedGetProject as getProject,
} from "@/lib/supabase";
import { ProjectLayoutClient } from "./project-layout-client";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
}

async function getProjectNavData(projectId: string) {
  // Run getCurrentUser and getProject in parallel
  // getCurrentUser will redirect if not authenticated
  const [, projectData] = await Promise.all([
    getCurrentUser(),
    getProject(projectId),
  ]);

  if (!projectData) {
    notFound();
  }

  const project = {
    id: projectData.project_id,
    name: projectData.name,
    organization_id: projectData.organization_id,
  };

  // Verify user has access to this project's organization
  // This depends on projectData, so it must be sequential
  const membership = await getOrganizationMembershipForCurrentUser(
    project.organization_id
  );

  if (!membership) {
    notFound();
  }

  return { project };
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { id } = await params;
  const { project } = await getProjectNavData(id);

  return (
    <ProjectLayoutClient projectId={project.id}>
      {children}
    </ProjectLayoutClient>
  );
}
